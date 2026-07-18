/* ImageData is a browser global; the drawing tools only need this much of it under Node. */
if (!('ImageData' in globalThis)) {
  class ImageDataShim {
    readonly width: number
    readonly height: number
    readonly data: Uint8ClampedArray

    constructor(dataOrWidth: Uint8ClampedArray | number, widthOrHeight: number, height?: number) {
      if (typeof dataOrWidth === 'number') {
        this.width = dataOrWidth
        this.height = widthOrHeight
        this.data = new Uint8ClampedArray(this.width * this.height * 4)
      } else {
        this.data = dataOrWidth
        this.width = widthOrHeight
        this.height = height ?? dataOrWidth.length / 4 / widthOrHeight
      }
    }
  }
  Object.assign(globalThis, { ImageData: ImageDataShim })
}
