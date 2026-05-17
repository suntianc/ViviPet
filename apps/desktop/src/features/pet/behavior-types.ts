export type BehaviorExpression =
  | 'neutral'
  | 'focused'
  | 'happy'
  | 'angry'
  | 'confused'
  | 'worried'
  | 'surprised'
  | 'sad';

export interface BehaviorProp {
  name: string;
  enabled: boolean;
}
