import { useAudioRecorder, useAudioRecorderState, RecordingPresets, requestRecordingPermissionsAsync } from "expo-audio";
import type { MessageAttachmentUpload } from "../api/client";

// Mobile pro-upgrade addendum, sub-phase M13 (voice notes). Wraps expo-audio's
// recorder + live-state hooks into the one shape the thread composer needs —
// start/stop/cancel plus a live duration for the recording-in-progress UI.
// HIGH_QUALITY's output container (.m4a, audio/mp4) is one of the four types
// saveMessageAttachment's ALLOWED_VOICE_NOTE_TYPES accepts (lib/uploads.ts).
export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 200);

  async function start(): Promise<boolean> {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) return false;
    await recorder.prepareToRecordAsync();
    recorder.record();
    return true;
  }

  // Returns null if there's nothing usable to send (e.g. stopped almost
  // instantly) — the caller treats that the same as a cancel rather than
  // sending an empty/near-zero-length attachment.
  async function stop(): Promise<MessageAttachmentUpload | null> {
    await recorder.stop();
    // getStatus() is a synchronous native call made *after* stop() resolves,
    // so it reflects the actual final duration — unlike state.durationMillis
    // (from useAudioRecorderState's 200ms poll), which can understate a
    // recording stopped right after a poll tick, wrongly discarding a
    // legitimately long-enough recording as "too short".
    const durationMillis = recorder.getStatus().durationMillis;
    if (!recorder.uri || durationMillis < 500) return null;
    return {
      uri: recorder.uri,
      name: `voice-note-${Date.now()}.m4a`,
      mimeType: "audio/mp4",
      kind: "voice_note",
      durationS: Math.round(durationMillis / 1000),
    };
  }

  async function cancel(): Promise<void> {
    await recorder.stop();
  }

  return {
    isRecording: state.isRecording,
    durationMillis: state.durationMillis,
    start,
    stop,
    cancel,
  };
}
