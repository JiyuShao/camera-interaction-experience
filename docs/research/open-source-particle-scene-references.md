# 粒子互动场景开源项目调研

> 调研快照：2026-09-21。结论基于两个仓库 `main` 分支的固定提交，重点评估粒子变形、手势稳定、媒体承载、移动端性能和许可风险。

## 结论摘要

两个参考项目都验证了同一条可行路线：用 GPU shader 在“聚合坐标”和“散开坐标”之间插值，以手势只驱动少量状态参数，而不是逐粒子更新 CPU 数据。

本项目已经采用更适合宝宝模型的版本：从真实 GLB 表面离线采样，运行时只加载紧凑点位数据，并按设备选择 12,000 / 20,000 / 30,000 粒子档位。因此不应照搬圣诞树项目的程序化锥体、React Three Fiber 组件树或大量独立照片 Mesh。值得吸收的是帧率无关阻尼、手势容错与丢失宽限、重复实体实例化，以及把相册改成清单驱动的资源层。

本轮最直接的实现启发是将场景旋转、缩放和自动旋转改为按 `delta` 计算的阻尼；这能避免 60 Hz、90 Hz、120 Hz 设备上出现不同手感。

## 参考项目一：moleculemmeng020425/christmas-tree

- 仓库：[moleculemmeng020425/christmas-tree](https://github.com/moleculemmeng020425/christmas-tree)
- 调研提交：[`78cc4e7`](https://github.com/moleculemmeng020425/christmas-tree/tree/78cc4e7181a2ef5f5a9e8d646fd980d87636f74e)
- 技术路线：React、React Three Fiber、Drei、Maath、`@react-three/postprocessing`、MediaPipe Gesture Recognizer。

### 值得参考的实现

1. **单一进度驱动形态变化。** 叶针粒子同时保存随机球形位置和树形目标位置，vertex shader 用一个进度 uniform 混合两组坐标，再叠加轻微的正弦扰动。CPU 只更新进度，粒子位置计算留在 GPU。见 [`src/App.tsx` 的粒子材质和点位生成](https://github.com/moleculemmeng020425/christmas-tree/blob/78cc4e7181a2ef5f5a9e8d646fd980d87636f74e/src/App.tsx#L57-L122)。
2. **帧率无关的过渡阻尼。** `MathUtils.damp(current, target, lambda, delta)` 用真实帧间隔推进状态，适合作为旋转、缩放、镜头和手势值的统一平滑方式。见 [`useFrame` 更新](https://github.com/moleculemmeng020425/christmas-tree/blob/78cc4e7181a2ef5f5a9e8d646fd980d87636f74e/src/App.tsx#L106-L112) 与 [Three.js `MathUtils.damp` 文档](https://threejs.org/docs/#api/en/math/MathUtils.damp)。
3. **把形态和镜头行为联动。** 聚合后自动旋转，散开时保留用户视角控制，让“状态变化”不仅是粒子坐标变化，也影响观看节奏。
4. **亮部阈值 Bloom。** 项目使用 Bloom + Vignette 做节日灯光气氛，参数集中在一个后期处理层。见 [`EffectComposer` 配置](https://github.com/moleculemmeng020425/christmas-tree/blob/78cc4e7181a2ef5f5a9e8d646fd980d87636f74e/src/App.tsx#L417-L420)。这个思路可作为高画质档的可选效果，而不应成为移动端基线。

### 不宜照搬的部分

- **README 与实际粒子规模不一致。** README 宣称 45,000+ 粒子，但当前配置中的主体叶针为 15,000，另有照片、装饰、灯和背景粒子。性能预算应以源码和真机测量为准，不能以宣传总数代替 draw call、过绘和纹理内存指标。见 [`CONFIG.counts`](https://github.com/moleculemmeng020425/christmas-tree/blob/78cc4e7181a2ef5f5a9e8d646fd980d87636f74e/src/App.tsx#L28-L54) 与 [README](https://github.com/moleculemmeng020425/christmas-tree/blob/78cc4e7181a2ef5f5a9e8d646fd980d87636f74e/README.md)。
- **照片数量和文件名硬编码。** README 要求 `1.jpg`、`2.jpg` 递增并手工修改数量，源码又为照片创建大量 React/R3F 对象。它适合固定展品，不适合“图片和视频数量宽泛”的目标。见 [README 的照片配置说明](https://github.com/moleculemmeng020425/christmas-tree/blob/78cc4e7181a2ef5f5a9e8d646fd980d87636f74e/README.md) 与 [`Polaroids` 实现](https://github.com/moleculemmeng020425/christmas-tree/blob/78cc4e7181a2ef5f5a9e8d646fd980d87636f74e/src/App.tsx#L125-L229)。
- **视觉识别跟随每个 RAF 执行。** Gesture Recognizer 在动画循环中持续推理，渲染频率越高推理调用越密，容易与 3D 渲染争抢移动端 GPU/CPU。见 [`predictWebcam`](https://github.com/moleculemmeng020425/christmas-tree/blob/78cc4e7181a2ef5f5a9e8d646fd980d87636f74e/src/App.tsx#L432-L493)。
- **手势类别直接切状态。** `Open_Palm` 和 `Closed_Fist` 的单帧结果直接触发形态变化，缺少确认窗口、滞回和手部短暂丢失保护，真实光照下容易抖动。
- **全量后处理不适合作为所有设备默认值。** Bloom 的全屏缓冲与高 DPI 会显著增加填充压力；本项目的加色混合叶光已经能形成辉光基调。

## 参考项目二：FisherBubble/3d-xmas-tree

- 仓库：[FisherBubble/3d-xmas-tree](https://github.com/FisherBubble/3d-xmas-tree)
- 调研提交：[`790b3e5`](https://github.com/FisherBubble/3d-xmas-tree/tree/790b3e506b77f0c302cf63d4ca6874f360c24819)
- 技术路线：React 外壳、原生 Three.js 场景、定制 GLSL、MediaPipe Hand Landmarker。

### 值得参考的实现

1. **主体用 `Points`，重复灯珠用 `InstancedMesh`。** 2,500 / 6,000 个主体粒子由单个点云绘制；350 个相同球体灯珠用实例化绘制。这种按视觉元素特性选 primitive 的做法比“所有元素都做 Mesh”更合理。见 [`ThreeScene.tsx`](https://github.com/FisherBubble/3d-xmas-tree/blob/790b3e506b77f0c302cf63d4ca6874f360c24819/components/ThreeScene.tsx#L26-L151) 与 [Three.js `InstancedMesh` 文档](https://threejs.org/docs/#api/en/objects/InstancedMesh)。
2. **限制像素比。** renderer 和 point size uniform 都把 device pixel ratio 上限设为 2，避免高 DPI 手机把像素工作量无意义放大。见 [`ThreeScene.tsx` renderer 初始化](https://github.com/FisherBubble/3d-xmas-tree/blob/790b3e506b77f0c302cf63d4ca6874f360c24819/components/ThreeScene.tsx#L39-L48)。
3. **基于手掌尺度的手势阈值。** 手指距离先除以手掌尺寸的隐含尺度，能降低手离镜头远近造成的阈值漂移。张掌采用“四指中三指满足即可”的多数票，而不是要求四指全部清晰。见 [`gestureLogic.ts`](https://github.com/FisherBubble/3d-xmas-tree/blob/790b3e506b77f0c302cf63d4ca6874f360c24819/utils/gestureLogic.ts#L29-L67)。
4. **短暂丢失宽限。** 散开手势消失后保留约 800–1000 ms，再决定回到聚合状态，能吸收遮挡、运动模糊和单帧误判。见 [`ThreeScene.tsx` 的手势状态处理](https://github.com/FisherBubble/3d-xmas-tree/blob/790b3e506b77f0c302cf63d4ca6874f360c24819/components/ThreeScene.tsx#L192-L225)。
5. **跟踪层与渲染层分离。** `HandTracker` 只输出结构化手部数据，`ThreeScene` 只消费状态。这个边界适合继续扩展“拳头 / 张掌 / 移动 / 捏合”，也方便用鼠标触控输入替代摄像头做测试。见 [`HandTracker.tsx`](https://github.com/FisherBubble/3d-xmas-tree/blob/790b3e506b77f0c302cf63d4ca6874f360c24819/components/HandTracker.tsx) 和 [`ThreeScene.tsx`](https://github.com/FisherBubble/3d-xmas-tree/blob/790b3e506b77f0c302cf63d4ca6874f360c24819/components/ThreeScene.tsx)。

### 不宜照搬的部分

- **质量分级过于粗糙。** 只按 `window.innerWidth < 768` 选择 2,500 或 6,000 粒子，未考虑设备像素比、GPU 能力、低电量/降级、帧率回退等因素。本项目已有 12k / 20k / 30k 三档，应保留现有策略。
- **动画速度依赖刷新率。** `transition += error * 0.045`、每帧固定旋转增量和 `time += 0.01` 会导致不同刷新率设备手感不同；应使用真实 `delta`。
- **MediaPipe 仍在每个 RAF 推理。** 虽然手势判断更稳，但推理调度没有与渲染循环解耦。见 [`HandTracker.tsx` 的 `predictLoop`](https://github.com/FisherBubble/3d-xmas-tree/blob/790b3e506b77f0c302cf63d4ca6874f360c24819/components/HandTracker.tsx#L92-L122)。
- **资源生命周期清理不完整。** 组件卸载时取消了 RAF，但当前源码没有显式关闭 Hand Landmarker；摄像头流的轨道停止也应由拥有流的上层统一负责。
- **宽限不是完整时间投票。** 800–1000 ms 丢失保护值得保留，但对“刚识别到某手势”仍需增加连续帧或时间窗口确认，避免单帧误触发。

## 对本项目的决策

| 模式 | 决策 | 本项目落法 |
| --- | --- | --- |
| 两组坐标 + shader uniform 插值 | 已采用 | 继续由 `BabyParticles` 在 GPU 中完成聚合/散开；模型表面点位保持离线预计算。 |
| `MathUtils.damp` + 帧间 `delta` | 采用 | 旋转、缩放、自动旋转都用帧率无关阻尼；后续手掌位置也进入同一平滑管线。 |
| 手掌尺度归一化 + 多数票 | 下一阶段采用 | 张掌允许 3/4 手指成立；拳头要求多指卷曲；阈值以掌长归一化，不使用固定屏幕像素。 |
| 手势时间确认 + 丢失宽限 | 下一阶段采用 | 建议 200–350 ms 成立确认，600–900 ms 丢失宽限，并对相反状态设置滞回。具体值以手机实测校准。 |
| 视觉推理与渲染解耦 | 下一阶段采用 | 渲染保持 RAF；手部推理先以 15–20 FPS 调度，只有新视频帧才推理，结果被渲染层平滑消费。 |
| 重复几何实例化 | 按需采用 | 叶片继续使用 point sprite；若加入立体相框、灯珠等同构几何，再使用 `InstancedMesh`。 |
| Bloom 后处理 | 延后 | 仅在高画质档做可开关试验；中低档继续依赖 additive sprite 与色彩设计。 |
| 数百个独立照片 Mesh | 拒绝 | 场景内只保留有限数量可见卡片；其余媒体由按需加载、复用材质/几何的画廊层承载。 |
| 固定数字文件名相册 | 拒绝 | 改用媒体 manifest，条目包含 `type: image | video`、URL、缩略图、尺寸、日期和文案；数量不写死。 |
| 挂载即请求摄像头 | 拒绝 | 欢迎页提供明确的“启用手势”按钮；拒绝权限或不支持时，触控/鼠标仍可完整运行。 |

## 手势阶段建议架构

1. `HandInput` 负责权限、摄像头、MediaPipe 初始化与释放，只输出 21 点 landmarks 和可信度。
2. `GestureClassifier` 把 landmarks 转成 `fist`、`openPalm`、`pinch`、`palmPose`，内部做尺度归一化和时间投票。
3. `GestureController` 把稳定手势映射到现有状态机：拳头聚合、张掌散开、掌心位移旋转、捏合打开当前媒体。
4. `PointerControls` 继续存在，作为 PC、Pad、手机的无摄像头降级方案与自动化测试入口。
5. 页面隐藏、退出手势模式或销毁场景时，停止视频轨道、取消推理调度并关闭视觉任务实例。

## 图片与视频数量宽泛时的媒体策略

- 构建时或启动时读取 manifest，不假定连续文件名，也不假定总数。
- 初始只加载封面/缩略图；图片原图和视频流在用户选中后再加载。
- 3D 场景同时展示 6–12 张代表卡片即可；大量项目放到虚拟列表/轮播层，避免数量线性增加 draw call 和纹理内存。
- 视频默认静态缩略图，用户打开后才创建 `<video>` / `VideoTexture`；关闭后暂停并释放引用。
- 对同尺寸相框复用 geometry，必要时用实例化；媒体纹理本身按可见集合做 LRU 回收。

## 许可结论

### moleculemmeng020425/christmas-tree

README 写明 “MIT License”，但调研提交的仓库根目录没有实际 `LICENSE` 文件。仅有 README 声明不足以消除授权文本、版权归属和许可范围的不确定性。对本项目的处理应是：**只借鉴公开可见的架构思想，不复制源码、shader 文本或素材**；若未来确需复用，先请仓库作者补充明确许可证。

### FisherBubble/3d-xmas-tree

仓库包含完整 [MIT License](https://github.com/FisherBubble/3d-xmas-tree/blob/790b3e506b77f0c302cf63d4ca6874f360c24819/LICENSE)，允许在保留版权和许可声明的前提下使用、复制和修改。本项目当前只吸收通用设计模式，没有复制代码；若以后直接移植实现片段，应在第三方声明中保留其 MIT 版权信息。

## 一手来源

- [moleculemmeng020425/christmas-tree 固定提交](https://github.com/moleculemmeng020425/christmas-tree/tree/78cc4e7181a2ef5f5a9e8d646fd980d87636f74e)
- [FisherBubble/3d-xmas-tree 固定提交](https://github.com/FisherBubble/3d-xmas-tree/tree/790b3e506b77f0c302cf63d4ca6874f360c24819)
- [Three.js Points](https://threejs.org/docs/#api/en/objects/Points)
- [Three.js ShaderMaterial](https://threejs.org/docs/#api/en/materials/ShaderMaterial)
- [Three.js InstancedMesh](https://threejs.org/docs/#api/en/objects/InstancedMesh)
- [Three.js MathUtils.damp](https://threejs.org/docs/#api/en/math/MathUtils.damp)
- [MediaPipe Hand Landmarker Web 指南](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js)

