// Keep browser gestures from taking over the game's touch controls.
// Leave single-finger scrolling and native button clicks intact in menus.
(() => {
  const preventZoom = event => {
    if (event.cancelable) event.preventDefault();
  };
  const options = { passive: false, capture: true };
  // Safari exposes pinch gestures separately from pointer events.
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(type, preventZoom, options);
  }
  document.addEventListener('touchmove', event => {
    if (event.touches.length > 1) preventZoom(event);
  }, options);
  document.addEventListener('dblclick', preventZoom, options);
})();
