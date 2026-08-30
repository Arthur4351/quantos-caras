// Mock canvas getContext for jsdom to allow Phaser imports in unit tests
if (typeof HTMLCanvasElement !== 'undefined') {
  // @ts-ignore
  HTMLCanvasElement.prototype.getContext = function(type: string) {
    if (type === '2d') {
      return {
        fillStyle: '',
        strokeStyle: '',
        fillRect: () => {},
        clearRect: () => {},
        getImageData: (x: number, y: number, w: number, h: number) => ({ data: new Uint8ClampedArray([0,0,0,0]), width: w, height: h, colorSpace: 'srgb' }),
        putImageData: () => {},
        createImageData: () => [],
        setTransform: () => {},
        drawImage: () => {},
        save: () => {},
        restore: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        closePath: () => {},
        stroke: () => {},
        translate: () => {},
        scale: () => {},
        rotate: () => {},
        arc: () => {},
        fill: () => {},
        measureText: () => ({ width: 0 }),
        transform: () => {},
        rect: () => {},
        clip: () => {},
        strokeRect: () => {},
        createLinearGradient: () => ({ addColorStop: () => {} }),
        createRadialGradient: () => ({ addColorStop: () => {} }),
      } as any;
    }
    if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl' || type === 'webgl2') {
      return { getExtension: () => null, getParameter: () => null } as any;
    }
    return null;
  } as any;
}
