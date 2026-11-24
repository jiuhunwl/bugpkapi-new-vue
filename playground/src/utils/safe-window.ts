function preopenDetachedWindow(): null | Window {
  const opened = window.open('', '_blank');
  if (!opened) {
    return null;
  }
  try {
    opened.opener = null;
    return opened;
  } catch {
    opened.close();
    return null;
  }
}

export { preopenDetachedWindow };
