import { useState, useEffect, useCallback } from 'react';
import { ActionType } from '../features/actions/action-schema';
import { BehaviorProp } from '../features/pet/behavior-types';

/** TTS 播放状态 */
export type TTSState =
  | { status: 'idle' }
  | { status: 'playing'; text: string }
  | { status: 'stopped' }
  | { status: 'error'; message: string };

interface PetState {
  currentAction: ActionType;
  actionRevision: number;
  currentExpression: string | null;
  expressionRevision: number;
  currentProps: BehaviorProp[];
  propsRevision: number;
  bubbleText: string;
  bubbleDuration: number;

  // TTS 相关
  isSpeaking: boolean;          // 是否正在 TTS 播报
  ttsState: TTSState;           // TTS 状态
  ttsAmplitude: number;         // 唇形同步振幅 0.0~1.0
  speechText: string;           // 当前正在说的文本（气泡用）
}

const initialState: PetState = {
  currentAction: 'idle',
  actionRevision: 0,
  currentExpression: null,
  expressionRevision: 0,
  currentProps: [],
  propsRevision: 0,
  bubbleText: '',
  bubbleDuration: 3000,

  isSpeaking: false,
  ttsState: { status: 'idle' },
  ttsAmplitude: 0,
  speechText: '',
};

class PetStore {
  private state: PetState = { ...initialState };
  private listeners: Set<(state: PetState) => void> = new Set();

  getState(): PetState {
    return { ...this.state };
  }

  subscribe(listener: (state: PetState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.getState());
    }
  }

  setAction(action: ActionType): void {
    this.state.currentAction = action;
    this.state.actionRevision += 1;
    this.notify();
  }

  setExpression(expression: string | null): void {
    if (this.state.currentExpression === expression) return;
    this.state.currentExpression = expression;
    this.state.expressionRevision += 1;
    this.notify();
  }

  setProps(props: BehaviorProp[]): void {
    const next = JSON.stringify(props);
    const current = JSON.stringify(this.state.currentProps);
    if (current === next) return;
    this.state.currentProps = props;
    this.state.propsRevision += 1;
    this.notify();
  }

  showBubble(text: string, duration?: number): void {
    this.state.bubbleText = text;
    if (duration !== undefined) {
      this.state.bubbleDuration = duration;
    }
    this.notify();
  }

  hideBubble(): void {
    this.state.bubbleText = '';
    this.notify();
  }

  // ---- TTS 相关 ----

  setIsSpeaking(speaking: boolean): void {
    this.state.isSpeaking = speaking;
    this.notify();
  }

  setTTSState(state: TTSState): void {
    this.state.ttsState = state;
    if (state.status === 'playing') {
      this.state.isSpeaking = true;
      this.state.speechText = state.text;
      // TTS 播放时**不同步气泡**——语音与气泡互斥
    } else {
      this.state.isSpeaking = false;
    }
    this.notify();
  }

  setTTSAmplitude(amplitude: number): void {
    this.state.ttsAmplitude = amplitude;
    this.notify();
  }

  setSpeechText(text: string): void {
    this.state.speechText = text;
    // speechText 只记录当前说的内容，不触发气泡显示
    this.notify();
  }
}

const petStoreInstance = new PetStore();

/**
 * React hook that wraps PetStore with reactive state binding.
 */
export function usePetStore() {
  const [state, setState] = useState<PetState>(() => petStoreInstance.getState());

  useEffect(() => {
    return petStoreInstance.subscribe((newState) => {
      setState(newState);
    });
  }, []);

  return {
    ...state,
    setAction: useCallback((action: ActionType) => petStoreInstance.setAction(action), []),
    setExpression: useCallback((expression: string | null) => petStoreInstance.setExpression(expression), []),
    setProps: useCallback((props: BehaviorProp[]) => petStoreInstance.setProps(props), []),
    showBubble: useCallback((text: string, duration?: number) => petStoreInstance.showBubble(text, duration), []),
    hideBubble: useCallback(() => petStoreInstance.hideBubble(), []),

    // TTS
    setIsSpeaking: useCallback((speaking: boolean) => petStoreInstance.setIsSpeaking(speaking), []),
    setTTSState: useCallback((ttsState: TTSState) => petStoreInstance.setTTSState(ttsState), []),
    setTTSAmplitude: useCallback((amp: number) => petStoreInstance.setTTSAmplitude(amp), []),
    setSpeechText: useCallback((text: string) => petStoreInstance.setSpeechText(text), []),
  };
}
