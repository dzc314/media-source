export function getMediaSource(
  preferManagedMediaSource = true,
) {
  if (typeof self === 'undefined') return undefined;
  const mms =
    (preferManagedMediaSource || !self.MediaSource) &&
    self.ManagedMediaSource;
  return (
    mms ||
    self.MediaSource ||
    self.WebKitMediaSource
  );
}

function getSourceBuffer(){
  return self.SourceBuffer || self.WebKitSourceBuffer;
}

export function isSupported() {
  const mediaSource = getMediaSource();
  if (!mediaSource) {
    return false;
  }
  const sourceBuffer = getSourceBuffer();
  const isTypeSupported =
    mediaSource &&
    typeof mediaSource.isTypeSupported === 'function' &&
    mediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E,mp4a.40.2"');

  // if SourceBuffer is exposed ensure its API is valid
  // Older browsers do not expose SourceBuffer globally so checking SourceBuffer.prototype is impossible
  const sourceBufferValidAPI =
    !sourceBuffer ||
    (sourceBuffer.prototype &&
      typeof sourceBuffer.prototype.appendBuffer === 'function' &&
      typeof sourceBuffer.prototype.remove === 'function');
  return !!isTypeSupported && !!sourceBufferValidAPI;
}


