import { useEffect, useRef, useState } from 'react'
import { AlertCircle, LoaderCircle, RefreshCw } from 'lucide-react'

export function VideoPlayer({ src, onDuration }: { src: string; onDuration?(duration: number): void }) {
  const [failure, setFailure] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [playbackState, setPlaybackState] = useState<'loading' | 'ready' | 'playing' | 'buffering' | 'ended'>('loading')
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    setFailure('')
    setPlaybackState('loading')
    videoRef.current?.load()
  }, [src, attempt])

  const markPlayable = () => {
    setPlaybackState((state) => state === 'playing' ? state : 'ready')
  }

  if (failure) {
    return <div className="playback-error" role="alert"><AlertCircle size={25} /><strong>无法解码视频</strong><span>{failure}</span><button className="secondary-button" onClick={() => { setFailure(''); setAttempt((value) => value + 1) }}><RefreshCw size={15} />重试播放</button></div>
  }

  return <div className="stable-video-player" data-playback-state={playbackState}>
    <video ref={videoRef} src={src} controls playsInline preload="metadata" onLoadStart={() => setPlaybackState('loading')} onLoadedMetadata={(event) => onDuration?.(event.currentTarget.duration)} onLoadedData={markPlayable} onCanPlay={markPlayable} onPlaying={() => setPlaybackState('playing')} onPause={() => setPlaybackState((state) => state === 'ended' || state === 'loading' ? state : 'ready')} onEnded={() => setPlaybackState('ended')} onWaiting={() => setPlaybackState('buffering')} onStalled={() => setPlaybackState('buffering')} onError={(event) => { const mediaError = event.currentTarget.error; const messages: Record<number, string> = { 1: '播放已中断。', 2: '无法读取本地媒体文件。', 3: '无法解码视频编解码器。', 4: '不支持此视频格式。' }; setFailure(messages[mediaError?.code ?? 0] || mediaError?.message || 'Electron 无法播放此视频。') }} />
    {playbackState === 'loading' && <div className="video-readiness" role="status"><LoaderCircle size={18} className="spin" /><span><strong>正在准备本地播放</strong><small>正在加载首个可播放帧…</small></span></div>}
    {playbackState === 'buffering' && <div className="video-buffering-status" role="status"><span />播放稳定中</div>}
    {playbackState === 'ended' && <button className="video-replay-button" type="button" onClick={() => { const video = videoRef.current; if (!video) return; video.currentTime = 0; void video.play() }}><RefreshCw size={15} />重播视频</button>}
  </div>
}

