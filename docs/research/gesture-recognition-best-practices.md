# 捏合与单手比心识别实践调研

> 调研快照：2026-09-22。资料优先采用 MediaPipe 官方文档与模型卡、Apple 官方手势示例、W3C/Immersive Web 资料和原始论文。本报告只提出方案，不修改产品代码。

## 结论

当前问题的根因不是“再调一个阈值”就能解决，而是识别链路把三件事混在了一起：

1. 只使用容易受透视影响的图像关键点，没有消费 MediaPipe 已经输出的米制三维 world landmarks。
2. 直接用几条布尔规则把每一帧强制归类，缺少独立的捏合/比心置信分与“不确定”区域。
3. 对离散标签做简单确认，没有先平滑连续几何量，也没有为进入和退出设置不同阈值。

推荐保留 Hand Landmarker，但把识别管线改成：

    image + world landmarks
            ↓
    手掌局部坐标与尺度归一化特征
            ↓
    One Euro 连续量滤波
            ↓
    pinchScore / heartScore / fistScore
            ↓
    带不确定区的互斥仲裁
            ↓
    进入/退出迟滞 + 连续证据帧 + 重新武装
            ↓
    交互意图

不建议直接换成 MediaPipe 的预置 Gesture Recognizer。它的内置类别只有 None、Closed_Fist、Open_Palm、Pointing_Up、Thumb_Down、Thumb_Up、Victory、ILoveYou，没有 pinch 或 finger-heart。[MediaPipe Web Gesture Recognizer](https://developers.google.com/edge/mediapipe/solutions/vision/gesture_recognizer/web_js)

## 一手资料里的关键实践

### 1. 同时使用图像关键点和世界关键点

MediaPipe Hand Landmarker 会同时返回：

- 图像坐标关键点：x/y 归一化到画面，z 以腕部为原点，值越小越靠近摄像头。
- 世界坐标关键点：以手部几何中心为原点、单位为米的三维坐标。
- 左右手类别。

官方 Gesture Recognizer 的模型卡显示，它的手势嵌入模型同时使用 21 个三维图像关键点、21 个三维米制世界关键点以及 handedness，而不是只看二维点。[Hand Landmarker 指南](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker)、[Gesture Recognizer 模型卡](https://storage.googleapis.com/mediapipe-assets/gesture_recognizer/model_card_hand_gesture_classification_with_faireness_2022.pdf)

对本项目的含义：

- 指尖前后关系可继续使用 normalized landmark 的相对 z。
- 指尖真实距离、关节弯曲角和手掌坐标系应优先使用 world landmarks。
- 左右手应镜像到同一个规范坐标系，再应用同一套规则。

### 2. 捏合应是连续量和状态，而不是单帧标签

Apple 的官方 Hand Pose 示例以拇指尖到食指尖的距离作为 pinch 观测值，但不会在一次越过阈值时立即切换。它为“可能捏合”和“可能分开”分别累积证据，默认连续 3 帧后才进入稳定的 pinched/apart 状态。[Apple WWDC20: Detect Body and Hand Pose with Vision](https://developer.apple.com/videos/play/wwdc2020/10653/)

WebXR Hand Input 的设计资料也把手势识别描述为有状态的问题，并使用指尖位置、指骨方向和关节姿态组合判断，而不只看单一距离。[WebXR Hand Input Explainer](https://github.com/immersive-web/webxr-hand-input/blob/main/explainer.md)

对本项目的含义：

- 输出连续的 pinchStrength，而不是只有 pinch true/false。
- 使用较严格的进入阈值和较宽松的退出阈值，避免在边界反复跳动。
- 进入和退出都需要证据帧；短暂一帧异常只降低置信度，不立刻切状态。

### 3. 先平滑几何量，再识别离散状态

One Euro Filter 是专为交互式运动信号设计的速度自适应低通滤波器：低速时强化平滑、减少抖动；快速移动时提高截止频率、减少延迟。原论文给出的核心目标正是平衡 jitter 和 lag。[1€ Filter 原始论文](https://direction.bordeaux.inria.fr/~roussel/publications/2012-CHI-one-euro-filter.pdf)

适合本项目的过滤对象不是最终手势标签，而是：

- 归一化拇指—食指距离；
- 三根辅助指的弯曲度；
- 食指相对拇指的前后深度；
- 手掌位置和朝向。

不建议先对最终标签做移动平均，因为标签一旦被错误硬分类，信息已经丢失。

### 4. 必须保留“不确定/无手势”样本

MediaPipe 自定义手势训练要求数据集中必须有 none 类，代表不属于目标手势的姿态。[MediaPipe 自定义手势指南](https://developers.google.com/edge/mediapipe/solutions/customization/gesture_recognizer)

HaGRIDv2 的原始研究也报告：补充自然手部姿态的 no_gesture 类后，误报下降约 6 倍。[HaGRIDv2 论文](https://arxiv.org/abs/2412.01508)、[官方数据仓库](https://github.com/hukenovs/hagrid)

即使继续使用规则法，也应该采用同样原则：当 pinch 和 heart 的分数接近、关键点置信不足或手位于画面边缘时，结果应为 neutral/uncertain，而不是按 if/else 顺序强制选一个。

### 5. 自定义模型是后备方案，不是第一步

MediaPipe 支持用自定义数据训练静态手势模型，并输出可在 Web 端运行的 task 文件。但官方页面目前明确标记 Model Maker “仍可用，但已不再积极维护”。[MediaPipe 自定义手势指南](https://developers.google.com/edge/mediapipe/solutions/customization/gesture_recognizer)

因此更稳妥的顺序是：

1. 先把 world landmarks、连续特征、迟滞状态机和真实样本校准做好。
2. 如果 finger-heart 仍因个体姿态差异难以用规则覆盖，再训练一个只负责 finger-heart / pinch / fist / none 的小型 landmark 分类器。
3. 训练集必须包含大量“拇指更靠前”“半握拳”“OK 手势”“指尖相邻但未捏合”等 hard negatives。

## 当前实现差距

| 当前实现 | 风险 | 推荐修正 |
| --- | --- | --- |
| hand.worker.ts 只回传 result.landmarks[0] | 丢弃米制世界关键点与 handedness | 回传 image landmarks、world landmarks、handedness |
| 手指伸展/弯曲主要用二维点距 | 手掌旋转或朝向镜头时阈值漂移 | 用 world landmark 关节角和掌心局部坐标 |
| pinch/heart 先后写在同一串 if/else | 模糊帧被强制归到优先级更高者 | 分别计算分数，低分或分差不足时返回 uncertain |
| hasTipContact 使用单帧固定阈值 | 指尖关键点抖动会快速进出阈值 | One Euro + enter/exit 双阈值 |
| 通用两帧稳定器处理所有姿态 | 没有针对 pinch release、heart toggle 的独立状态 | 每个动作使用独立证据计数和重新武装条件 |
| 主要依靠人工构造单帧测试点 | 无法覆盖真实摄像头噪声、遮挡和个人姿势 | 录制匿名 landmark 序列，加入回放测试 |

## 推荐实现

### 第一阶段：重构输入与特征

单帧结构应同时包含 imageLandmarks、worldLandmarks、handedness 和 timestamp。

从 world landmarks 构造手掌局部坐标：

- 原点：掌心几何中心；
- 横轴：index MCP → pinky MCP；
- 纵轴：wrist → middle MCP；
- 法线：横轴与纵轴叉乘；
- 尺度：掌宽与掌长的均值；
- 左手镜像到右手规范空间。

使用三维关节角判断 middle/ring/pinky 的伸展与弯曲；不要再只比较 tip 到 wrist/MCP 的二维距离。

### 第二阶段：两个独立评分器

pinchScore 建议组合：

- 拇指尖—食指尖三维距离 / 掌宽；
- 中指、无名指、小指的伸展分；
- 食指可弯曲，但不能是三指收拢的拳形；
- 关键点追踪质量与画面边缘惩罚。

heartScore 建议组合：

- 拇指尖—食指尖距离；
- 拇指末节与食指末节在掌心局部平面的交叉/夹角；
- 中指、无名指、小指的弯曲分；
- normalized z 中食指尖比拇指尖更靠近摄像头；
- 与 fist、pinch 分数的差值。

仲裁规则：

- 最高分未过进入阈值：uncertain；
- 第一、第二名分差不足：uncertain；
- 只有分数和分差都满足时才产生候选手势。

阈值不要直接照搬固定数值，应从目标设备和使用者录制的 landmark 序列中估计分布。

### 第三阶段：时序状态机

每个动作分别维护：

- enterThreshold 与 exitThreshold；
- 连续证据（建议以 Apple 示例的 3 帧作为初始值）；
- 一帧异常容忍；
- 跟踪丢失宽限；
- 触发后的重新武装条件。

finger-heart 是切换动作，只在上升沿触发一次；必须回到 neutral/open 并保持一段时间后才能再次触发。pinch 是持续动作，进入后应保持到 pinchScore 低于退出阈值且退出证据成立。

### 第四阶段：可观测性与校准

增加仅开发环境可见的诊断面板：

- raw / filtered pinch distance；
- 三根辅助指的 curl；
- pinchScore / heartScore / margin；
- 当前候选、稳定状态、进入/退出证据帧；
- handedness、跟踪丢失次数和推理 FPS。

增加 landmark-only 录制与回放，不保存摄像头图像。至少采集：

- 每种目标手势 30 次；
- 正面、侧转、近/远、明/暗；
- pinch ↔ heart、fist ↔ heart 的过渡；
- 自然放松和调整手位的 none 样本。

把误识别序列固化为回归测试，再调阈值。

## 建议验收指标

以下是本项目的工程目标，不是来源中的通用标准：

- 静止保持时标签每 10 秒跳变不超过 1 次；
- 空闲状态误触发少于 1 次/分钟；
- pinch 进入中位延迟 250–450 ms，退出不超过 300 ms；
- heart 进入中位延迟 350–600 ms；
- pinch / heart / fist 三类混淆率低于 5%；
- PC、平板、手机至少各一台实机通过相同回放集与人工操作。

## 推荐优先级

1. **最高优先级：** 回传并使用 world landmarks 与 handedness。
2. **最高优先级：** pinch/heart 独立连续评分，加入 uncertain 区域。
3. **高优先级：** One Euro 过滤连续特征，使用进入/退出迟滞和 3 帧证据。
4. **高优先级：** landmark 录制、诊断面板与回放测试。
5. **后备方案：** 规则法经过真实样本校准仍不够时，再训练轻量自定义分类器。

这一方案能直接针对当前“抖动、互相误识别、换角度失效”三个症状，同时保持浏览器本地推理和现有 Worker 架构。
