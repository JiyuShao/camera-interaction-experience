export interface AutoMediaButtonState {
  label: string;
  pressed: 'true' | 'false';
  title: string;
}

export function autoMediaControlState(active: boolean): AutoMediaButtonState {
  return active
    ? { label: '停止', pressed: 'true', title: '停止自动回忆' }
    : { label: '自动', pressed: 'false', title: '开启自动回忆' };
}
