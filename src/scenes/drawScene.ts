import { Container, Graphics } from 'pixi.js'
import type { SceneId } from './catalog'

export const SCENE_WIDTH = 900
export const SCENE_HEIGHT = 480

type Shape = (graphics: Graphics) => void

export interface SceneDrawing {
  container: Container
  select: (id: string | null) => void
}

/** A scene contains visual geometry and pointer intents only. */
export function drawScene(scene: SceneId, onSelect: (id: string) => void): SceneDrawing {
  const container = new Container()
  const highlights = new Map<string, Graphics>()
  const background = new Graphics()
  container.addChild(background)

  const object = (id: string, paint: Shape, outline: Shape) => {
    const target = new Container()
    const art = new Graphics()
    paint(art)
    const highlight = new Graphics()
    outline(highlight)
    highlight.visible = false
    target.addChild(art, highlight)
    target.eventMode = 'static'
    target.cursor = 'pointer'
    target.on('pointertap', () => onSelect(id))
    highlights.set(id, highlight)
    container.addChild(target)
  }

  if (scene === 'estate') {
    background.rect(0, 0, 900, 480).fill(0xd6ded0)
      .rect(0, 0, 900, 195).fill(0xc6d9d5)
      .circle(716, 69, 32).fill({ color: 0xf7e4b7, alpha: 0.85 })
      .poly([0, 163, 108, 93, 206, 143, 312, 78, 445, 156, 562, 92, 686, 153, 793, 106, 900, 159, 900, 230, 0, 230]).fill(0xa1b9aa)
      .poly([0, 190, 126, 139, 251, 178, 361, 127, 495, 185, 603, 139, 735, 181, 900, 129, 900, 252, 0, 252]).fill(0x839d86)
      .poly([0, 223, 173, 188, 335, 214, 501, 177, 675, 213, 900, 179, 900, 480, 0, 480]).fill(0xb4bd83)
      .poly([0, 315, 305, 218, 556, 249, 900, 202, 900, 480, 0, 480]).fill(0x9ca966)
      .poly([0, 429, 358, 290, 456, 303, 150, 480, 0, 480]).fill(0xd1b887)
      .poly([328, 480, 541, 292, 580, 299, 421, 480]).fill(0xcab482)

    // Distant cypress trees establish the horizon and scale.
    for (const [x, y, height] of [[76, 191, 48], [140, 183, 39], [273, 199, 56], [594, 177, 43], [800, 184, 54], [844, 181, 40]]) {
      background.ellipse(x, y, 9, height / 2).fill(0x536d51)
        .rect(x - 2, y + height / 2 - 3, 4, 15).fill(0x695d43)
    }

    object('west-parcel', (g) => {
      g.poly([25, 339, 303, 249, 407, 274, 152, 397]).fill(0x718e53)
      for (let n = 0; n < 8; n += 1) {
        g.moveTo(41 + n * 15, 343 + n * 6).lineTo(309 + n * 11, 257 + n * 3).stroke({ color: 0xd2c681, width: 5 })
          .moveTo(44 + n * 15, 347 + n * 6).lineTo(311 + n * 11, 261 + n * 3).stroke({ color: 0x4e734a, width: 3 })
      }
    }, (g) => g.poly([25, 339, 303, 249, 407, 274, 152, 397]).stroke({ color: 0xffefb7, width: 5 }))

    object('east-parcel', (g) => {
      g.poly([463, 349, 679, 262, 866, 292, 689, 422]).fill(0x778b4a)
      for (let n = 0; n < 8; n += 1) {
        g.moveTo(479 + n * 25, 348 + n * 8).lineTo(686 + n * 21, 268 + n * 4).stroke({ color: 0xd3c483, width: 5 })
          .moveTo(481 + n * 25, 352 + n * 8).lineTo(688 + n * 21, 272 + n * 4).stroke({ color: 0x536f45, width: 3 })
      }
    }, (g) => g.poly([463, 349, 679, 262, 866, 292, 689, 422]).stroke({ color: 0xffefb7, width: 5 }))

    object('estate-house', (g) => {
      g.poly([439, 197, 503, 172, 608, 191, 545, 221]).fill(0x87594a)
        .poly([439, 197, 545, 221, 545, 278, 439, 252]).fill(0xe5d4ae)
        .poly([545, 221, 608, 191, 608, 248, 545, 278]).fill(0xcab993)
        .poly([466, 199, 499, 181, 554, 192, 520, 212]).fill(0xb57558)
        .rect(469, 215, 13, 18).fill(0x5f6653).rect(506, 225, 13, 19).fill(0x5f6653)
        .poly([560, 229, 579, 220, 579, 251, 560, 261]).fill(0x7b6650)
        .rect(540, 164, 14, 28).fill(0xd2c09b).poly([536, 164, 547, 154, 558, 164]).fill(0x9e6650)
    }, (g) => g.poly([439, 197, 503, 172, 608, 191, 608, 248, 545, 278, 439, 252]).stroke({ color: 0xffefb7, width: 5 }))
  } else if (scene === 'winery') {
    background.rect(0, 0, 900, 480).fill(0xdecfb7)
      .poly([0, 0, 900, 0, 900, 313, 0, 313]).fill(0xb9ab91)
      .poly([0, 290, 900, 290, 900, 480, 0, 480]).fill(0xad9a7d)
      .poly([0, 0, 900, 0, 900, 28, 0, 28]).fill(0x5f5245)
    for (let x = 0; x < 900; x += 150) background.rect(x, 0, 18, 302).fill({ color: 0x6e5b4a, alpha: 0.55 })
    for (let x = 90; x < 900; x += 205) {
      background.roundRect(x, 54, 112, 136, 44).fill(0x7e7866)
        .roundRect(x + 9, 63, 94, 118, 38).fill(0xc8d8bd)
        .moveTo(x + 56, 65).lineTo(x + 56, 180).stroke({ color: 0x8a8e77, width: 5 })
        .moveTo(x + 10, 119).lineTo(x + 102, 119).stroke({ color: 0x8a8e77, width: 5 })
    }
    for (let y = 322; y < 480; y += 37) background.moveTo(0, y).lineTo(900, y).stroke({ color: 0x887a68, width: 2 })
    for (let x = -350; x < 1000; x += 110) background.moveTo(x, 480).lineTo(x + 250, 290).stroke({ color: 0x8f806c, width: 2 })
    background.rect(30, 256, 837, 11).fill(0x5d554c)

    const vessel = (id: string, x: number) => object(id, (g) => {
      g.ellipse(x + 73, 393, 85, 20).fill({ color: 0x594d43, alpha: 0.22 })
        .rect(x + 14, 187, 117, 176).fill(0xa5a79c)
        .ellipse(x + 72, 187, 58.5, 19).fill(0xd9d9c9)
        .ellipse(x + 72, 363, 58.5, 19).fill(0x8d958e)
        .rect(x + 28, 195, 12, 160).fill({ color: 0xffffff, alpha: 0.18 })
        .moveTo(x + 14, 232).lineTo(x + 131, 232).stroke({ color: 0x777f77, width: 4 })
        .moveTo(x + 14, 329).lineTo(x + 131, 329).stroke({ color: 0x777f77, width: 4 })
        .rect(x + 53, 267, 38, 43).fill(0x595e55).circle(x + 72, 289, 8).stroke({ color: 0xe7ddc5, width: 3 })
        .rect(x + 63, 158, 18, 13).fill(0x666e65)
        .moveTo(x + 13, 364).lineTo(x + 13, 390).moveTo(x + 131, 364).lineTo(x + 131, 390).stroke({ color: 0x666e65, width: 7 })
    }, (g) => g.roundRect(x + 8, 168, 128, 218, 32).stroke({ color: 0xffedb3, width: 5 }))
    vessel('vessel-one', 150)
    vessel('vessel-two', 388)

    object('work-area', (g) => {
      g.ellipse(731, 405, 111, 18).fill({ color: 0x594d43, alpha: 0.2 })
        .poly([622, 308, 758, 308, 821, 338, 685, 338]).fill(0x826b53)
        .poly([622, 308, 685, 338, 685, 353, 622, 323]).fill(0x634f40)
        .poly([685, 338, 821, 338, 821, 353, 685, 353]).fill(0x725b49)
        .rect(696, 350, 10, 54).fill(0x5e5144).rect(801, 350, 10, 54).fill(0x5e5144)
        .rect(701, 279, 35, 29).fill(0xc8b99e).rect(747, 269, 17, 39).fill(0x68796d)
    }, (g) => g.poly([615, 301, 761, 301, 830, 334, 830, 359, 685, 359, 615, 326]).stroke({ color: 0xffedb3, width: 5 }))
  } else if (scene === 'cellar') {
    background.rect(0, 0, 900, 480).fill(0x685347)
      .poly([0, 0, 900, 0, 900, 305, 0, 305]).fill(0x8c7962)
      .poly([0, 310, 900, 310, 900, 480, 0, 480]).fill(0x9e896c)
    for (let x = 25; x < 900; x += 210) {
      background.roundRect(x, 33, 174, 256, 84).fill(0x6b5b4c)
        .roundRect(x + 13, 47, 148, 242, 72).fill(0x4d463d)
        .moveTo(x + 22, 211).lineTo(x + 152, 211).stroke({ color: 0x9d8569, width: 10 })
    }
    for (let y = 339; y < 480; y += 40) background.moveTo(0, y).lineTo(900, y).stroke({ color: 0x786c59, width: 2 })
    for (let x = -300; x < 1100; x += 118) background.moveTo(x, 480).lineTo(x + 250, 310).stroke({ color: 0x786c59, width: 2 })

    object('bottle-bay', (g) => {
      g.rect(75, 141, 233, 157).fill(0x624b3c)
      for (let y = 155; y < 287; y += 33) {
        g.rect(83, y + 20, 218, 7).fill(0xa8825b)
        for (let x = 95; x < 290; x += 25) g.roundRect(x, y, 9, 19, 3).fill(0x293e34).rect(x + 3, y - 4, 3, 5).fill(0x293e34)
      }
    }, (g) => g.rect(70, 136, 243, 167).stroke({ color: 0xffe7a7, width: 5 }))

    object('barrel-bay', (g) => {
      for (const [x, y] of [[413, 308], [539, 308], [665, 308], [474, 233], [600, 233]]) {
        g.ellipse(x + 3, y + 73, 70, 13).fill({ color: 0x332a25, alpha: 0.2 })
          .roundRect(x - 57, y - 45, 114, 91, 22).fill(0xa77d50)
          .ellipse(x - 45, y, 22, 45).fill(0x80613f)
          .ellipse(x + 45, y, 23, 45).fill(0xc39761)
          .ellipse(x + 45, y, 18, 38).stroke({ color: 0x7e6144, width: 4 })
          .moveTo(x - 23, y - 43).lineTo(x - 23, y + 43).moveTo(x + 13, y - 44).lineTo(x + 13, y + 44).stroke({ color: 0x64584d, width: 6 })
      }
    }, (g) => g.roundRect(347, 180, 385, 181, 45).stroke({ color: 0xffe7a7, width: 5 }))

    object('wine', (g) => {
      g.ellipse(810, 408, 55, 13).fill({ color: 0x332a25, alpha: 0.25 })
        .roundRect(789, 315, 34, 78, 7).fill(0x344d3c)
        .rect(798, 296, 16, 23).fill(0x344d3c).rect(798, 291, 16, 8).fill(0x793d3a)
        .rect(793, 339, 26, 29).fill(0xe0d1af)
        .moveTo(848, 336).lineTo(848, 389).moveTo(832, 389).lineTo(865, 389).stroke({ color: 0xd9c9ad, width: 3 })
        .ellipse(848, 330, 16, 19).stroke({ color: 0xd9c9ad, width: 3 })
    }, (g) => g.roundRect(780, 284, 90, 117, 12).stroke({ color: 0xffe7a7, width: 5 }))
  } else {
    background.rect(0, 0, 900, 480).fill(0xd5ddd0)
      .rect(0, 0, 900, 260).fill(0xc9d9d3)
      .circle(720, 92, 47).fill({ color: 0xf7e5b9, alpha: 0.85 })
      .poly([0, 228, 152, 155, 293, 222, 440, 134, 608, 224, 760, 162, 900, 223, 900, 310, 0, 310]).fill(0x9db3a0)
      .poly([0, 281, 180, 224, 351, 269, 563, 209, 744, 265, 900, 229, 900, 480, 0, 480]).fill(0xa7b48a)
      .poly([0, 358, 242, 301, 486, 344, 707, 288, 900, 332, 900, 480, 0, 480]).fill(0x899f76)
      .ellipse(465, 410, 210, 29).fill({ color: 0x51634e, alpha: 0.22 })
      .poly([277, 335, 463, 267, 650, 335, 463, 404]).fill(0xbda77f)
      .poly([322, 277, 465, 222, 608, 277, 465, 331]).fill(0x98725c)
      .poly([322, 277, 465, 331, 465, 367, 322, 314]).fill(0xe0d1b2)
      .poly([465, 331, 608, 277, 608, 314, 465, 367]).fill(0xcab99b)
      .rect(437, 170, 56, 102).fill(0xe1d2b4)
      .poly([422, 171, 465, 136, 507, 171]).fill(0x946954)
      .roundRect(453, 202, 23, 42, 12).fill(0x6d7562)
      .poly([393, 278, 465, 251, 537, 278, 465, 305]).fill(0xc9b593)
  }

  return {
    container,
    select(id) {
      highlights.forEach((highlight, key) => { highlight.visible = key === id })
    },
  }
}
