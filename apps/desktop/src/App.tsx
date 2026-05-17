import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PetStage } from './components/PetStage';
import { SpeechBubble } from './components/SpeechBubble';
import { usePetStore } from './stores/pet-store';
import { loadModelConfigs, ModelConfig } from './features/pet/model-registry';
import { StreamingAudioPlayer } from './audio/streaming-player';

interface TTSStateEvent {
  status: 'idle' | 'playing' | 'completed' | 'stopped' | 'error';
  requestId?: string;
  text?: string;
}

interface TTSConfigSnapshot {
  enabled?: boolean;
  source?: string;
  fallbackToBubble?: boolean;
}

interface TTSAudioChunkEvent {
  data: Uint8Array;
  format: string;
  sampleRate: number;
  seq: number;
  isFinal: boolean;
}

const App: React.FC = () => {
  const [modelIndex, setModelIndex] = useState(0);
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [modelRevision, setModelRevision] = useState(0);
  const actionResetTimerRef = useRef<number | null>(null);
  const audioPlayerRef = useRef<StreamingAudioPlayer | null>(null);
  const pendingTTSFallbackRef = useRef<Map<string, { text: string; duration: number }>>(new Map());
  const pendingTTSSequenceRef = useRef(0);

  const {
    currentAction,
    actionRevision,
    currentExpression,
    expressionRevision,
    currentProps,
    propsRevision,
    bubbleText,
    bubbleDuration,
    isSpeaking,
    ttsAmplitude,
    showBubble,
    hideBubble,
    setAction,
    setTTSState,
    setTTSAmplitude,
    setIsSpeaking,
  } = usePetStore();

  const clearActionResetTimer = useCallback(() => {
    if (actionResetTimerRef.current !== null) {
      window.clearTimeout(actionResetTimerRef.current);
      actionResetTimerRef.current = null;
    }
  }, []);

  const scheduleIdle = useCallback((delay: number) => {
    clearActionResetTimer();
    actionResetTimerRef.current = window.setTimeout(() => {
      actionResetTimerRef.current = null;
      setAction('idle');
    }, delay);
  }, [clearActionResetTimer, setAction]);

  useEffect(() => {
    return () => {
      clearActionResetTimer();
    };
  }, [clearActionResetTimer]);

  useEffect(() => {
    const player = new StreamingAudioPlayer();
    audioPlayerRef.current = player;
    player.onAmplitude((rms) => setTTSAmplitude(rms));
    player.onEnded(() => setIsSpeaking(false));
    return () => {
      player.dispose();
      audioPlayerRef.current = null;
    };
  }, [setIsSpeaking, setTTSAmplitude]);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.petTTS?.onTTSState) return;
    return api.petTTS.onTTSState((stateRaw: unknown) => {
      const state = stateRaw as TTSStateEvent;
      if (state.status === 'completed') {
        if (state.requestId) {
          pendingTTSFallbackRef.current.delete(state.requestId);
        }
        return;
      }

      setTTSState(state.status === 'playing'
        ? { status: 'playing', text: state.text || '' }
        : { status: state.status as 'idle' | 'stopped' | 'error' });

      if (state.status === 'error') {
        const fallbackKey = state.requestId && pendingTTSFallbackRef.current.has(state.requestId)
          ? state.requestId
          : (pendingTTSFallbackRef.current.keys().next().value as string | undefined);
        if (!fallbackKey) return;
        const fallback = pendingTTSFallbackRef.current.get(fallbackKey);
        pendingTTSFallbackRef.current.delete(fallbackKey);
        if (fallback) showBubble(fallback.text, fallback.duration);
      }

      if ((state.status === 'idle' || state.status === 'stopped') && pendingTTSFallbackRef.current.size > 0) {
        pendingTTSFallbackRef.current.clear();
      }
    });
  }, [setTTSState, showBubble]);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.petTTS?.onTTSAudioChunk) return;
    return api.petTTS.onTTSAudioChunk((chunkRaw: unknown) => {
      const chunk = chunkRaw as TTSAudioChunkEvent;
      audioPlayerRef.current?.pushChunk({
        data: chunk.data,
        format: chunk.format as 'wav' | 'mp3' | 'pcm',
        sampleRate: chunk.sampleRate,
        seq: chunk.seq,
        isFinal: chunk.isFinal,
      });
    });
  }, []);

  const [ttsConfig, setTTSConfig] = useState<TTSConfigSnapshot>({});
  const updateTTSConfigSnapshot = useCallback((cfg: any) => {
    setTTSConfig({
      enabled: cfg?.enabled === true,
      source: cfg?.source,
      fallbackToBubble: cfg?.fallbackToBubble !== false,
    });
  }, []);

  useEffect(() => {
    const api = window.electronAPI?.petTTS;
    api?.getConfig().then(updateTTSConfigSnapshot).catch(() => {});
    const cleanup = api?.onTTSConfig?.(updateTTSConfigSnapshot);
    return cleanup;
  }, [updateTTSConfigSnapshot]);

  const ttsConfigRef = useRef<TTSConfigSnapshot>({});
  ttsConfigRef.current = ttsConfig;

  const handleSpeech = useCallback((text: string) => {
    if (!text?.trim()) return;
    const duration = Math.min(3000 + text.length * 50, 15000);
    const cfg = ttsConfigRef.current;
    const ttsAvailable = cfg.enabled === true && cfg.source !== 'none';

    if (!ttsAvailable) {
      showBubble(text, duration);
      return;
    }

    const fallbackKey = `pending_${++pendingTTSSequenceRef.current}`;
    if (cfg.fallbackToBubble !== false) {
      pendingTTSFallbackRef.current.set(fallbackKey, { text, duration });
    }

    window.electronAPI?.petTTS?.speak(text, { text, model: 'preset' }).then((result: { ok?: boolean; requestId?: string } | undefined) => {
      if (result?.ok === true && result.requestId && pendingTTSFallbackRef.current.has(fallbackKey)) {
        const fallback = pendingTTSFallbackRef.current.get(fallbackKey)!;
        pendingTTSFallbackRef.current.delete(fallbackKey);
        pendingTTSFallbackRef.current.set(result.requestId, fallback);
        return;
      }
      if (pendingTTSFallbackRef.current.has(fallbackKey)) {
        const fallback = pendingTTSFallbackRef.current.get(fallbackKey)!;
        pendingTTSFallbackRef.current.delete(fallbackKey);
        showBubble(fallback.text, fallback.duration);
      }
    }).catch(() => {
      if (pendingTTSFallbackRef.current.has(fallbackKey)) {
        const fallback = pendingTTSFallbackRef.current.get(fallbackKey)!;
        pendingTTSFallbackRef.current.delete(fallbackKey);
        showBubble(fallback.text, fallback.duration);
      }
    });
  }, [showBubble]);

  useEffect(() => {
    let cancelled = false;
    loadModelConfigs().then((loadedModels) => {
      if (cancelled) return;
      setModels(loadedModels);
      setModelIndex((index) => Math.min(index, Math.max(0, loadedModels.length - 1)));
      window.electronAPI?.petWindow?.setModelNames?.(loadedModels.map((model) => model.name));
    });

    return () => {
      cancelled = true;
    };
  }, [modelRevision]);

  useEffect(() => {
    window.electronAPI?.petWindow?.setCurrentModelIndex?.(modelIndex);
  }, [modelIndex]);

  const handleClick = useCallback(() => {
    clearActionResetTimer();
    setAction('clicked');
    scheduleIdle(300);
  }, [clearActionResetTimer, scheduleIdle, setAction]);

  const handleDoubleClick = useCallback(() => {
    clearActionResetTimer();
    setAction('doubleClicked');
    scheduleIdle(500);
  }, [clearActionResetTimer, scheduleIdle, setAction]);

  const handleDragStart = useCallback(() => {
    clearActionResetTimer();
    setAction('dragging');
  }, [clearActionResetTimer, setAction]);

  const handleDragEnd = useCallback(() => {
    clearActionResetTimer();
    setAction('idle');
  }, [clearActionResetTimer, setAction]);

  const handleMenuAction = useCallback((action: string) => {
    const modelMatch = action.match(/^model:(\d+)$/);
    if (modelMatch) {
      const newIndex = parseInt(modelMatch[1], 10);
      setModelIndex(Math.max(0, Math.min(newIndex, models.length - 1)));
      return;
    }

    switch (action) {
      case 'importModel':
        window.electronAPI?.petModel?.import().then((result) => {
          if (result) {
            handleSpeech('Model imported! Reloading...');
            setModelRevision((value) => value + 1);
          }
        });
        break;
      case 'refreshModels':
        handleSpeech('Model imported! Reloading...');
        setModelRevision((value) => value + 1);
        break;
      default:
        break;
    }
  }, [handleSpeech, models.length]);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onPetAction) return;

    return api.onPetAction((action: string, params?: unknown) => {
      console.log(`[IPC] Received action: ${action}`, params);

      if (action.startsWith('resizePet:')) {
        const scale = parseFloat(action.split(':')[1]);
        if (!isNaN(scale)) {
          document.documentElement.dataset.petScale = String(scale);
        }
        return;
      }

      if (action === 'mouseFollow:on' || action === 'mouseFollow:off') {
        const enabled = action === 'mouseFollow:on';
        document.documentElement.dataset.mouseFollow = String(enabled);
        if (!enabled) {
          document.documentElement.dataset.resetPointer = 'now';
          setAction('idle');
        }
        return;
      }

      if (action === 'mousePassthrough:on' || action === 'mousePassthrough:off') {
        const enabled = action === 'mousePassthrough:on';
        document.documentElement.dataset.mousePassthrough = String(enabled);
        api.petWindow?.setIgnoreMouseEvents?.(enabled, { forward: true });
        return;
      }

      if (action.startsWith('model:') || action === 'importModel' || action === 'refreshModels') {
        handleMenuAction(action);
        return;
      }

      clearActionResetTimer();
      setAction(action);
    });
  }, [clearActionResetTimer, handleMenuAction, setAction]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <PetStage
        currentAction={currentAction}
        actionRevision={actionRevision}
        currentExpression={currentExpression}
        expressionRevision={expressionRevision}
        currentProps={currentProps}
        propsRevision={propsRevision}
        interactionLocked={false}
        models={models}
        modelIndex={modelIndex}
        isSpeaking={isSpeaking}
        ttsAmplitude={ttsAmplitude}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      />

      {bubbleText && (
        <SpeechBubble
          text={bubbleText}
          duration={bubbleDuration}
          onClose={hideBubble}
        />
      )}
    </div>
  );
};

export default App;
