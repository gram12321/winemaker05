import { Container, Graphics, Polygon } from "pixi.js";
import type { SceneId, SceneObjectId } from "../experience";
import type { SceneVisuals } from "./sceneVisuals";
import { formatNumber } from "../shared/numberFormat";

type Points = number[];

export const SCENE_WIDTH = 1000;
export const SCENE_HEIGHT = 530;

interface Hotspot {
  id: SceneObjectId;
  points: Points;
  marker: [number, number];
}

export interface DrawnScene {
  root: Container;
  setSelection: (id: SceneObjectId | null) => void;
  setVisuals: (visuals: SceneVisuals) => void;
}

function polygon(parent: Container, points: Points, color: number, alpha = 1) {
  parent.addChild(new Graphics().poly(points, true).fill({ color, alpha }));
}

function rectangle(parent: Container, x: number, y: number, width: number, height: number, color: number, radius = 0) {
  const graphic = new Graphics();
  if (radius) graphic.roundRect(x, y, width, height, radius);
  else graphic.rect(x, y, width, height);
  parent.addChild(graphic.fill(color));
}

function ellipse(parent: Container, x: number, y: number, rx: number, ry: number, color: number, alpha = 1) {
  parent.addChild(new Graphics().ellipse(x, y, rx, ry).fill({ color, alpha }));
}

function parentLiquid(parent: Container, x: number, y: number, width: number, height: number, color: number) {
  if (height > 0) parent.addChild(new Graphics().rect(x, y, width, height).fill({ color, alpha: 0.78 }));
}

function line(parent: Container, points: Points, color: number, width = 2, alpha = 1) {
  const graphic = new Graphics().moveTo(points[0], points[1]);
  for (let index = 2; index < points.length; index += 2) {
    graphic.lineTo(points[index], points[index + 1]);
  }
  parent.addChild(graphic.stroke({ color, width, alpha, cap: "round", join: "round" }));
}

function tree(parent: Container, x: number, y: number, scale = 1, color = 0x556448) {
  rectangle(parent, x - 3 * scale, y - 25 * scale, 6 * scale, 28 * scale, 0x6a543f);
  ellipse(parent, x, y - 31 * scale, 15 * scale, 19 * scale, color);
  ellipse(parent, x - 10 * scale, y - 27 * scale, 10 * scale, 12 * scale, color);
  ellipse(parent, x + 10 * scale, y - 29 * scale, 10 * scale, 13 * scale, color);
  ellipse(parent, x - 4 * scale, y - 39 * scale, 8 * scale, 7 * scale, 0xa2a66b, 0.35);
}

function cypress(parent: Container, x: number, y: number, scale = 1) {
  rectangle(parent, x - 2 * scale, y - 12 * scale, 4 * scale, 13 * scale, 0x67533d);
  polygon(parent, [x, y - 75 * scale, x - 12 * scale, y - 13 * scale, x + 12 * scale, y - 13 * scale], 0x465b42);
  polygon(parent, [x, y - 69 * scale, x - 3 * scale, y - 15 * scale, x + 7 * scale, y - 15 * scale], 0x6b7853, 0.55);
}

function estateBuilding(parent: Container) {
  ellipse(parent, 637, 333, 152, 30, 0x5c6245, 0.22);
  polygon(parent, [526, 209, 635, 252, 635, 332, 526, 288], 0xd7bf91);
  polygon(parent, [635, 252, 738, 199, 738, 278, 635, 332], 0xb69b72);
  polygon(parent, [512, 213, 624, 145, 750, 197, 635, 263], 0x975e49);
  polygon(parent, [512, 213, 624, 145, 635, 155, 529, 220], 0xb47c5e);
  for (let index = 0; index < 6; index += 1) {
    const offset = index * 17;
    line(parent, [535 + offset, 203 - offset * 0.54, 648 + offset, 249 - offset * 0.54], 0x744b3e, 1.3, 0.45);
  }
  polygon(parent, [548, 248, 565, 255, 565, 280, 548, 273], 0x55634e);
  polygon(parent, [586, 263, 604, 270, 604, 296, 586, 289], 0x55634e);
  polygon(parent, [669, 253, 689, 243, 689, 276, 669, 286], 0x725440);
  polygon(parent, [706, 232, 722, 224, 722, 248, 706, 256], 0x55634e);
  polygon(parent, [609, 304, 626, 311, 626, 328, 609, 321], 0x765540);
  tree(parent, 512, 297, 0.6, 0x71815a);
}

function vineyardRows(parent: Container, topLeft: [number, number], topRight: [number, number], bottomLeft: [number, number], bottomRight: [number, number]) {
  for (let index = 0; index <= 14; index += 1) {
    const t = index / 14;
    const x1 = topLeft[0] + (topRight[0] - topLeft[0]) * t;
    const y1 = topLeft[1] + (topRight[1] - topLeft[1]) * t;
    const x2 = bottomLeft[0] + (bottomRight[0] - bottomLeft[0]) * t;
    const y2 = bottomLeft[1] + (bottomRight[1] - bottomLeft[1]) * t;
    line(parent, [x1, y1, x2, y2], index % 3 === 0 ? 0xddd09a : 0x6f784b, index % 3 === 0 ? 3 : 7, 0.85);
  }
}

function drawSeasonCalendar(root: Container, visuals: SceneVisuals) {
  rectangle(root, 804, 14, 180, 60, 0xf4ecd8, 0.94);
  drawNumberCounter(root, 894, 19, visuals.calendar.year, 0x544839);
  rectangle(root, 816, 43, 154, 6, 0xc9bea7);
  rectangle(root, 816, 43, 154 * visuals.calendar.season / visuals.calendar.seasonsPerYear, 6, 0x637753);
  rectangle(root, 816, 57, 154, 6, 0xc9bea7);
  rectangle(root, 816, 57, 154 * visuals.calendar.week / visuals.calendar.weeksPerSeason, 6, 0x9c654a);
}

/** A compact, symbolic planting panel; its icons are not parcel locations. */
function drawVineyardStatus(root: Container, visuals: SceneVisuals, x: number, y: number, width: number) {
  const columns = 4;
  const rows = Math.max(1, Math.ceil(visuals.vineyards.length / columns));
  const height = 20 + rows * 26 + (visuals.activeHarvestCount > 0 ? 18 : 0);
  rectangle(root, x, y, width, height, 0xf1ead8, 0.92);
  if (!visuals.vineyards.length) {
    for (let index = 0; index < 4; index += 1) {
      line(root, [x + 16, y + 24 + index * 7, x + width - 16, y + 24 + index * 7], 0x988568, 2, 0.8);
    }
  }
  visuals.vineyards.forEach((vineyard, index) => {
    const cellX = x + 18 + (index % columns) * ((width - 36) / columns);
    const cellY = y + 18 + Math.floor(index / columns) * 26;
    line(root, [cellX, cellY + 10, cellX + 36, cellY + 10], 0x78634a, 2, 0.8);
    line(root, [cellX + 18, cellY + 9, cellX + 18, cellY - 2], 0x78634a, 2, 0.8);
    ellipse(root, cellX + 12, cellY + 1, 6, 4, 0x77865c);
    ellipse(root, cellX + 24, cellY + 1, 6, 4, 0x77865c);
    if (vineyard.ripeness > 0) {
      ellipse(root, cellX + 18, cellY - 2, 3, 3, 0xa87a52, vineyard.ripeness);
    }
    if (vineyard.harvestableKg > 0) {
      ellipse(root, cellX + 14, cellY + 7, 2.5, 2.5, 0x6e3f45);
      ellipse(root, cellX + 18, cellY + 9, 2.5, 2.5, 0x6e3f45);
      ellipse(root, cellX + 22, cellY + 7, 2.5, 2.5, 0x6e3f45);
    }
    if (vineyard.harvestedKg > 0) rectangle(root, cellX + 29, cellY + 3, 6, 7, 0xb68e58, 1);
  });
  if (visuals.activeHarvestCount > 0) {
    for (let index = 0; index < visuals.activeHarvestCount; index += 1) {
      const crateX = x + 14 + index * 18;
      rectangle(root, crateX, y + height - 14, 11, 9, 0xb68e58, 1);
      line(root, [crateX + 2, y + height - 10, crateX + 9, y + height - 10], 0x76573d, 1);
    }
  }
}

function drawEstate(root: Container, visuals?: SceneVisuals): Hotspot[] {
  rectangle(root, 0, 0, 1000, 530, 0xd8dfcf);
  ellipse(root, 805, 67, 45, 45, 0xf6e8bd, 0.9);
  polygon(root, [0, 175, 130, 102, 235, 155, 348, 87, 487, 163, 625, 92, 789, 151, 885, 106, 1000, 164, 1000, 270, 0, 270], 0xa6b29a);
  polygon(root, [0, 205, 126, 158, 255, 194, 395, 146, 542, 198, 691, 152, 830, 194, 1000, 143, 1000, 300, 0, 300], 0x879a7d);
  polygon(root, [0, 238, 172, 190, 325, 215, 475, 185, 650, 214, 812, 178, 1000, 215, 1000, 530, 0, 530], 0x879167);
  polygon(root, [0, 329, 269, 226, 544, 332, 264, 530, 0, 530], 0xa4a96b);
  polygon(root, [35, 274, 313, 221, 492, 316, 205, 446], 0xb9ba79);
  if (!visuals) vineyardRows(root, [35, 274], [313, 221], [205, 446], [492, 316]);
  polygon(root, [221, 456, 508, 326, 687, 408, 495, 530, 220, 530], 0x969c63);
  if (!visuals) vineyardRows(root, [240, 460], [510, 339], [300, 530], [660, 410]);
  polygon(root, [518, 357, 765, 265, 1000, 349, 1000, 530, 779, 530], 0xb0a570);
  polygon(root, [594, 355, 715, 310, 1000, 437, 1000, 484], 0xd7c598);
  polygon(root, [0, 489, 189, 415, 304, 530, 0, 530], 0x707c55);
  for (let index = 0; index < 9; index += 1) {
    tree(root, 792 + index * 24, 317 + (index % 2) * 18, 0.5, index % 2 ? 0x687a51 : 0x778858);
  }
  for (let index = 0; index < 9; index += 1) {
    cypress(root, 118 + index * 87, 232 - (index % 3) * 10, 0.46);
  }
  estateBuilding(root);
  cypress(root, 470, 322, 1.05);
  cypress(root, 753, 315, 1.03);
  tree(root, 893, 457, 1.1, 0x657a4e);
  tree(root, 947, 484, 1.2, 0x7d8956);
  tree(root, 58, 471, 1.12, 0x60764f);
  if (visuals) {
    drawSeasonCalendar(root, visuals);
    drawVineyardStatus(root, visuals, 12, 74, 268);
  }
  return [
    { id: "estate-parcel", points: [35, 274, 313, 221, 492, 316, 205, 446], marker: [255, 325] },
    { id: "estate-building", points: [512, 213, 624, 145, 750, 197, 738, 278, 635, 332, 526, 288], marker: [637, 225] },
    { id: "estate-grounds", points: [690, 333, 805, 299, 1000, 369, 1000, 530, 815, 530], marker: [842, 396] },
  ];
}

function floor(root: Container, wall: number, floorColor: number) {
  rectangle(root, 0, 0, 1000, 530, wall);
  polygon(root, [0, 322, 1000, 322, 1000, 530, 0, 530], floorColor);
  for (let index = -4; index <= 10; index += 1) {
    line(root, [500 + index * 105, 322, 500 + index * 190, 530], 0x6e5d4d, 2, 0.2);
  }
  for (let index = 1; index <= 4; index += 1) {
    const y = 322 + index * index * 12;
    line(root, [0, y, 1000, y], 0x6e5d4d, 2, 0.2);
  }
}

function tank(root: Container, x: number, y: number, scale = 1, fillRatio?: number) {
  ellipse(root, x + 50 * scale, y + 190 * scale, 62 * scale, 13 * scale, 0x4f4438, 0.25);
  rectangle(root, x + 15 * scale, y + 25 * scale, 70 * scale, 145 * scale, 0xa9aea3, 16 * scale);
  if (fillRatio !== undefined && fillRatio > 0) {
    const fillHeight = 128 * scale * fillRatio;
    parentLiquid(root, x + 23 * scale, y + 161 * scale - fillHeight, 54 * scale, fillHeight, 0x77634a);
  }
  rectangle(root, x + 22 * scale, y + 33 * scale, 13 * scale, 128 * scale, 0xe3e1cf, 6 * scale);
  rectangle(root, x + 66 * scale, y + 34 * scale, 10 * scale, 126 * scale, 0x707e77, 5 * scale);
  ellipse(root, x + 50 * scale, y + 27 * scale, 35 * scale, 12 * scale, 0xcdd0c1);
  ellipse(root, x + 50 * scale, y + 23 * scale, 18 * scale, 5 * scale, 0x8c978c);
  line(root, [x + 16 * scale, y + 76 * scale, x + 84 * scale, y + 76 * scale], 0x78877d, 3 * scale, 0.7);
  line(root, [x + 16 * scale, y + 139 * scale, x + 84 * scale, y + 139 * scale], 0x78877d, 3 * scale, 0.7);
  line(root, [x + 26 * scale, y + 165 * scale, x + 22 * scale, y + 190 * scale], 0x716c5f, 5 * scale);
  line(root, [x + 74 * scale, y + 165 * scale, x + 78 * scale, y + 190 * scale], 0x716c5f, 5 * scale);
}

function concreteTank(root: Container, x: number, y: number, scale = 1, fillRatio = 0) {
  ellipse(root, x + 50 * scale, y + 190 * scale, 62 * scale, 13 * scale, 0x4f4438, 0.25);
  rectangle(root, x + 15 * scale, y + 25 * scale, 70 * scale, 145 * scale, 0xb9b19e, 10 * scale);
  if (fillRatio > 0) {
    const fillHeight = 128 * scale * fillRatio;
    parentLiquid(root, x + 23 * scale, y + 161 * scale - fillHeight, 54 * scale, fillHeight, 0x77634a);
  }
  line(root, [x + 18 * scale, y + 78 * scale, x + 82 * scale, y + 78 * scale], 0x8f897a, 3 * scale, 0.7);
  line(root, [x + 18 * scale, y + 133 * scale, x + 82 * scale, y + 133 * scale], 0x8f897a, 3 * scale, 0.7);
  line(root, [x + 30 * scale, y + 34 * scale, x + 30 * scale, y + 160 * scale], 0xd8d1c0, 3 * scale, 0.8);
  line(root, [x + 70 * scale, y + 34 * scale, x + 70 * scale, y + 160 * scale], 0x938c7b, 2 * scale, 0.7);
  ellipse(root, x + 50 * scale, y + 27 * scale, 35 * scale, 12 * scale, 0xc8c0ad);
  ellipse(root, x + 50 * scale, y + 23 * scale, 18 * scale, 5 * scale, 0x8c877a);
  line(root, [x + 26 * scale, y + 165 * scale, x + 22 * scale, y + 190 * scale], 0x716c5f, 5 * scale);
  line(root, [x + 74 * scale, y + 165 * scale, x + 78 * scale, y + 190 * scale], 0x716c5f, 5 * scale);
}

function barrel(root: Container, x: number, y: number, scale = 1, fillRatio?: number) {
  ellipse(root, x + 50 * scale, y + 69 * scale, 59 * scale, 12 * scale, 0x40372c, 0.25);
  rectangle(root, x + 13 * scale, y + 6 * scale, 79 * scale, 57 * scale, 0xa57749, 18 * scale);
  if (fillRatio !== undefined && fillRatio > 0) {
    const fillHeight = 38 * scale * fillRatio;
    parentLiquid(root, x + 35 * scale, y + 60 * scale - fillHeight, 36 * scale, fillHeight, 0x77634a);
  }
  ellipse(root, x + 16 * scale, y + 34 * scale, 16 * scale, 28 * scale, 0xc39862);
  ellipse(root, x + 90 * scale, y + 34 * scale, 14 * scale, 28 * scale, 0x8d633e);
  line(root, [x + 30 * scale, y + 10 * scale, x + 30 * scale, y + 59 * scale], 0x595b4f, 5 * scale);
  line(root, [x + 72 * scale, y + 10 * scale, x + 72 * scale, y + 59 * scale], 0x595b4f, 5 * scale);
  line(root, [x + 18 * scale, y + 20 * scale, x + 18 * scale, y + 47 * scale], 0xe5bc81, 2 * scale, 0.6);
}

function drawVesselGlyphs(root: Container, vessels: SceneVisuals['vessels']) {
  const tankVessels = vessels.filter(vessel => vessel.material !== 'oak');
  const oakVessels = vessels.filter(vessel => vessel.material === 'oak');
  const tankColumns = 3;
  const tankRows = Math.max(1, Math.ceil(tankVessels.length / tankColumns));
  const tankScale = Math.min(0.86, 1.72 / tankRows);
  tankVessels.forEach((vessel, index) => {
    const x = 164 + (index % tankColumns) * 132;
    const y = 135 + Math.floor(index / tankColumns) * (320 / tankRows);
    if (vessel.material === 'concrete') concreteTank(root, x, y, tankScale, vessel.fillRatio);
    else tank(root, x, y, tankScale, vessel.fillRatio);
  });
  const barrelColumns = 2;
  const barrelRows = Math.max(1, Math.ceil(oakVessels.length / barrelColumns));
  const barrelScale = Math.min(0.78, 2.7 / barrelRows);
  oakVessels.forEach((vessel, index) => {
    const x = 822 + (index % barrelColumns) * 74;
    const y = 218 + Math.floor(index / barrelColumns) * (238 / barrelRows);
    barrel(root, x, y, barrelScale, vessel.fillRatio);
  });
}

function drawWinery(root: Container, visuals?: SceneVisuals): Hotspot[] {
  floor(root, 0xc7b99e, 0xb7aa8d);
  rectangle(root, 0, 0, 1000, 35, 0x56493b);
  for (let index = 0; index < 8; index += 1) {
    rectangle(root, index * 145 - 20, 0, 19, 322, 0x796a55);
    line(root, [index * 145 - 10, 35, index * 145 + 70, 0], 0x6a5948, 10);
  }
  for (let index = 0; index < 4; index += 1) {
    const x = 70 + index * 245;
    rectangle(root, x, 65, 92, 112, 0x786f5a, 44);
    rectangle(root, x + 8, 73, 76, 96, 0xdce4c5, 37);
    line(root, [x + 46, 75, x + 46, 168], 0x9e9d82, 4);
    line(root, [x + 10, 120, x + 82, 120], 0x9e9d82, 4);
  }
  if (visuals) drawSeasonCalendar(root, visuals);
  rectangle(root, 0, 300, 1000, 18, 0x81725b);
  if (visuals) {
    drawVesselGlyphs(root, visuals.vessels);
  } else {
    tank(root, 170, 160, 1.18);
    tank(root, 337, 185, 0.96);
    tank(root, 465, 208, 0.76);
    barrel(root, 829, 285, 0.95);
    barrel(root, 866, 233, 0.75);
  }
  rectangle(root, 601, 294, 198, 20, 0x6a4e38, 4);
  polygon(root, [601, 294, 635, 277, 830, 277, 799, 294], 0xa8815c);
  rectangle(root, 616, 314, 12, 80, 0x6d5542);
  rectangle(root, 774, 314, 12, 80, 0x6d5542);
  rectangle(root, 653, 248, 58, 30, 0xbda77f, 3);
  line(root, [659, 259, 706, 259], 0x8a7759, 2);
  cypress(root, 561, 311, 0.42);
  return [
    { id: "winery-vessel", points: visuals ? [144, 126, 574, 126, 574, 461, 144, 461] : [172, 173, 300, 164, 311, 357, 178, 370], marker: visuals ? [354, 408] : [240, 248] },
    { id: "winery-work", points: [592, 273, 821, 273, 821, 396, 592, 396], marker: [705, 305] },
    { id: "winery-barrel", points: visuals ? [805, 210, 990, 210, 990, 461, 805, 461] : [821, 230, 975, 230, 975, 365, 821, 365], marker: visuals ? [902, 430] : [903, 282] },
  ];
}

function arch(root: Container, x: number, y: number, width: number, height: number) {
  const curve = new Graphics()
    .moveTo(x, y + height)
    .lineTo(x, y + width / 2)
    .bezierCurveTo(x, y - width * 0.16, x + width, y - width * 0.16, x + width, y + width / 2)
    .lineTo(x + width, y + height)
    .closePath()
    .fill(0x5a4a3c);
  root.addChild(curve);
  const border = new Graphics()
    .moveTo(x, y + height)
    .lineTo(x, y + width / 2)
    .bezierCurveTo(x, y - width * 0.16, x + width, y - width * 0.16, x + width, y + width / 2)
    .lineTo(x + width, y + height)
    .stroke({ color: 0xb9a17c, width: 14 });
  root.addChild(border);
}

function bottles(root: Container, x: number, y: number, columns: number, rows: number) {
  rectangle(root, x - 10, y - 10, columns * 24 + 20, rows * 24 + 20, 0x4a3b31, 4);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      ellipse(root, x + column * 24 + 8, y + row * 24 + 8, 6, 6, 0x887953);
      ellipse(root, x + column * 24 + 8, y + row * 24 + 8, 3, 3, 0x343b2e);
    }
  }
}

function bottleGlyph(root: Container, x: number, y: number, color: number) {
  rectangle(root, x + 3, y + 5, 8, 18, color, 2);
  rectangle(root, x + 5, y, 4, 7, 0x68563d, 1);
  rectangle(root, x + 4, y + 7, 2, 13, 0xb9a57e, 1);
}

function drawNumberCounter(root: Container, x: number, y: number, value: number, color: number, groupDigits = false) {
  const segments: Record<string, readonly number[]> = {
    '0': [0, 1, 2, 3, 4, 5], '1': [1, 2], '2': [0, 1, 6, 4, 3],
    '3': [0, 1, 6, 2, 3], '4': [5, 6, 1, 2], '5': [0, 5, 6, 2, 3],
    '6': [0, 5, 6, 4, 2, 3], '7': [0, 1, 2], '8': [0, 1, 2, 3, 4, 5, 6],
    '9': [0, 1, 2, 3, 5, 6], '-': [6],
  };
  const characters = (groupDigits ? formatNumber(value, { fractionDigits: 0 }) : String(value)).split('');
  const digitCount = characters.filter(character => character !== ' ').length;
  const groupCount = characters.length - digitCount;
  const digitWidth = Math.min(10, 158 / Math.max(1, digitCount));
  const groupGap = Math.min(4, digitWidth * 0.5);
  const segmentWidth = digitWidth * 0.55;
  const segmentThickness = Math.max(1, digitWidth * 0.18);
  const leftX = digitWidth * 0.05;
  const rightX = digitWidth * 0.72;
  const shapes: readonly [number, number, number, number][] = [
    [leftX, 0, segmentWidth, segmentThickness],
    [rightX, 1.5, segmentThickness, 4.5],
    [rightX, 8.5, segmentThickness, 4.5],
    [leftX, 13, segmentWidth, segmentThickness],
    [0, 8.5, segmentThickness, 4.5],
    [0, 1.5, segmentThickness, 4.5],
    [leftX, 6.5, segmentWidth, segmentThickness],
  ];
  const displayWidth = digitCount * digitWidth + groupCount * groupGap;
  let cursorX = x - (displayWidth - 2) / 2;
  characters.forEach(digit => {
    if (digit === ' ') {
      cursorX += groupGap;
      return;
    }
    for (const segment of segments[digit] ?? []) {
      const [offsetX, offsetY, width, height] = shapes[segment];
      rectangle(root, cursorX + offsetX, y + offsetY, width, height, color, 1);
    }
    cursorX += digitWidth;
  });
}

function drawBottleCountPanel(root: Container, count: number) {
  rectangle(root, 70, 132, 202, 198, 0xf1ead8, 4);
  bottleGlyph(root, 163, 165, count > 0 ? 0x596849 : 0xaaa68e);
  line(root, [104, 198, 238, 198], 0xc2b69e, 1.5);
  drawNumberCounter(root, 171, 214, count, 0x526846, true);
}

function drawVesselOverview(root: Container, vessels: SceneVisuals['vessels']) {
  const x = 390;
  const y = 140;
  const width = 215;
  const height = 191;
  rectangle(root, x, y, width, height, 0xf1ead8, 4);
  const rowSpace = (height - 24) / Math.max(1, vessels.length);
  vessels.forEach((vessel, index) => {
    const rowY = y + 12 + index * rowSpace;
    const color = vessel.material === 'oak' ? 0x8f6240 : vessel.material === 'concrete' ? 0x898370 : 0x657b84;
    rectangle(root, x + 12, rowY, 8, 8, color, 1);
    rectangle(root, x + 27, rowY, width - 39, 8, 0xc9bea7, 2);
    rectangle(root, x + 27, rowY, (width - 39) * vessel.fillRatio, 8, color, 2);
  });
}

function drawCellar(root: Container, visuals?: SceneVisuals): Hotspot[] {
  floor(root, 0x9d8b70, 0x88745d);
  for (let index = 0; index < 5; index += 1) {
    line(root, [0, 55 + index * 53, 1000, 55 + index * 53], 0x6e5d4b, 2, 0.2);
  }
  if (visuals) drawSeasonCalendar(root, visuals);
  arch(root, 50, 37, 260, 300);
  arch(root, 370, 16, 260, 321);
  arch(root, 690, 37, 260, 300);
  if (visuals) {
    drawBottleCountPanel(root, visuals.bottlesInCellar);
  } else {
    bottles(root, 93, 143, 7, 7);
    bottles(root, 733, 143, 7, 7);
  }
  if (visuals) {
    drawVesselOverview(root, visuals.vessels);
  } else {
    rectangle(root, 411, 140, 180, 191, 0x6c5a45, 4);
    for (let index = 0; index < 4; index += 1) {
      line(root, [417, 168 + index * 45, 584, 168 + index * 45], 0xb59a71, 8);
    }
    barrel(root, 307, 285, 1.28);
    barrel(root, 447, 288, 1.28);
    barrel(root, 385, 217, 1.05);
  }
  polygon(root, [659, 427, 857, 379, 1000, 415, 1000, 530, 732, 530], 0x71513b);
  polygon(root, [659, 427, 857, 379, 1000, 415, 814, 473], 0x9b7552);
  if (!visuals || visuals.bottlesInCellar > 0) {
    rectangle(root, 830, 343, 35, 83, 0x374636, 10);
    rectangle(root, 839, 317, 17, 34, 0x374636, 3);
    rectangle(root, 834, 373, 27, 24, 0xd7c59f, 2);
    ellipse(root, 856, 432, 35, 9, 0x4a382c, 0.2);
  }
  return [
    { id: "cellar-barrels", points: visuals ? [382, 132, 620, 132, 620, 339, 382, 339] : [301, 224, 566, 224, 590, 389, 301, 389], marker: visuals ? [500, 326] : [446, 308] },
    { id: "cellar-shelves", points: [78, 130, 281, 130, 281, 330, 78, 330], marker: [178, 220] },
    { id: "cellar-wine", points: visuals ? [722, 130, 922, 130, 922, 450, 722, 450] : [805, 306, 885, 306, 900, 440, 804, 440], marker: [850, 370] },
  ];
}

function drawCompany(root: Container, visuals?: SceneVisuals): Hotspot[] {
  rectangle(root, 0, 0, 1000, 530, 0xd6dfcc);
  ellipse(root, 786, 70, 43, 43, 0xf4e8c5);
  polygon(root, [0, 254, 184, 145, 360, 237, 514, 123, 720, 229, 878, 150, 1000, 223, 1000, 530, 0, 530], 0xa4b39b);
  polygon(root, [0, 326, 245, 205, 419, 295, 602, 190, 805, 300, 1000, 221, 1000, 530, 0, 530], 0x849b80);
  polygon(root, [0, 397, 264, 296, 490, 382, 741, 286, 1000, 376, 1000, 530, 0, 530], 0x718a6d);
  ellipse(root, 515, 422, 308, 49, 0x536e57, 0.35);
  polygon(root, [315, 387, 510, 303, 711, 382, 515, 465], 0xc7b995);
  polygon(root, [315, 387, 515, 465, 515, 490, 315, 412], 0x9d8c6c);
  polygon(root, [515, 465, 711, 382, 711, 408, 515, 490], 0x897b62);
  rectangle(root, 453, 335, 124, 48, 0xa59c82);
  polygon(root, [442, 335, 510, 310, 586, 335, 515, 361], 0xe1d6b7);
  rectangle(root, 474, 229, 82, 100, 0xcac0a2);
  polygon(root, [466, 229, 515, 204, 566, 229, 515, 249], 0xe3d8b7);
  rectangle(root, 501, 164, 28, 54, 0xa79c80, 10);
  ellipse(root, 515, 152, 21, 24, 0xd2c6a7);
  line(root, [515, 179, 482, 205], 0xb7ab8e, 14);
  line(root, [515, 179, 548, 205], 0xb7ab8e, 14);
  polygon(root, [106, 292, 183, 259, 256, 288, 179, 326], 0x965e4e);
  polygon(root, [106, 292, 179, 326, 179, 380, 106, 346], 0xd2c39d);
  polygon(root, [179, 326, 256, 288, 256, 344, 179, 380], 0xb4a681);
  rectangle(root, 132, 311, 17, 24, 0x5b6d59);
  cypress(root, 95, 348, 0.75);
  cypress(root, 273, 339, 0.8);
  tree(root, 772, 359, 1.1, 0x5d7659);
  tree(root, 836, 382, 0.9, 0x789165);
  tree(root, 897, 407, 1.1, 0x5c7358);
  if (visuals) {
    drawSeasonCalendar(root, visuals);
    drawVineyardStatus(root, visuals, 12, 374, 268);
  }
  return [
    { id: "company-portfolio", points: [91, 260, 266, 260, 266, 384, 91, 384], marker: [176, 302] },
    { id: "company-landmark", points: [438, 129, 585, 129, 585, 380, 438, 380], marker: [515, 245] },
    { id: "company-milestones", points: [732, 287, 941, 287, 941, 432, 732, 432], marker: [824, 354] },
  ];
}

export function drawScene(scene: SceneId, onSelect: (id: SceneObjectId) => void, initialVisuals?: SceneVisuals): DrawnScene {
  const root = new Container();
  const outlines = new Map<SceneObjectId, Graphics>();
  let visuals = initialVisuals;
  let selection: SceneObjectId | null = null;

  function applySelection() {
    for (const [objectId, outline] of outlines) outline.visible = objectId === selection;
  }

  function renderScene() {
    for (const child of root.removeChildren()) child.destroy({ children: true });
    outlines.clear();
    const hotspots = {
      estate: drawEstate,
      winery: drawWinery,
      cellar: drawCellar,
      company: drawCompany,
    }[scene](root, visuals);

    for (const hotspot of hotspots) {
      const target = new Container();
      target.eventMode = "static";
      target.cursor = "pointer";
      target.hitArea = new Polygon(hotspot.points);
      target.on("pointertap", () => onSelect(hotspot.id));

      const outline = new Graphics().poly(hotspot.points, true).stroke({ color: 0xffe8a7, width: 5, join: "round" });
      outline.visible = false;
      outline.eventMode = "none";
      target.addChild(outline);
      outlines.set(hotspot.id, outline);

      const [x, y] = hotspot.marker;
      const marker = new Graphics()
        .circle(x, y + 2, 18).fill({ color: 0x382a23, alpha: 0.22 })
        .circle(x, y, 17).fill(0xf8efd8)
        .circle(x, y, 13).fill(0x67473b)
        .moveTo(x - 5, y).lineTo(x + 5, y)
        .moveTo(x, y - 5).lineTo(x, y + 5)
        .stroke({ color: 0xfff3d9, width: 2, cap: "round" });
      marker.eventMode = "none";
      target.addChild(marker);
      root.addChild(target);
    }
    applySelection();
  }

  renderScene();
  return {
    root,
    setSelection(id) {
      selection = id;
      applySelection();
    },
    setVisuals(nextVisuals) {
      if (visuals === nextVisuals) return;
      visuals = nextVisuals;
      renderScene();
    },
  };
}
