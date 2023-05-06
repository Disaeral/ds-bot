const fs = require("fs");
const PNG = require("pngjs").PNG;

// Read the PNG image file

const defaultDic = {
  0: "⠀",
  1: "⠁",
  12: "⠃",
  14: "⠉",
  145: "⠙",
  15: "⠑",
  124: "⠋",
  1245: "⠛",
  125: "⠓",
  24: "⠊",
  245: "⠚",
  4: "⠈",
  45: "⠘",
  3: "⠄",
  13: "⠅",
  123: "⠇",
  134: "⠍",
  1345: "⠝",
  135: "⠕",
  1234: "⠏",
  12345: "⠟",
  1235: "⠗",
  234: "⠎",
  2345: "⠞",
  34: "⠌",
  345: "⠜",
  36: "⠤",
  136: "⠥",
  1236: "⠧",
  1346: "⠭",
  13456: "⠽",
  1356: "⠵",
  12346: "⠯",
  123456: "⠿",
  12356: "⠷",
  2346: "⠮",
  23456: "⠾",
  346: "⠬",
  3456: "⠼",
  6: "⠠",
  16: "⠡",
  126: "⠣",
  146: "⠩",
  1456: "⠹",
  156: "⠱",
  1246: "⠫",
  12456: "⠻",
  1256: "⠳",
  246: "⠪",
  2456: "⠺",
  46: "⠨",
  456: "⠸",
  2: "⠂",
  23: "⠆",
  25: "⠒",
  256: "⠲",
  26: "⠢",
  235: "⠖",
  2356: "⠶",
  236: "⠦",
  35: "⠔",
  356: "⠴",
  5: "⠐",
  56: "⠰",
};

const remapNumberKeysToBinary = (obj) => {
  const copy = new Map();
  Object.keys(obj).map((objectKey, objectKeyIndex) => {
    const binary = new Array(6).fill(0);
    objectKey
      .toString()
      .split("")
      .map((digit, digIndex) => {
        binary.map((binaryZero, zeroIndex) => {
          if (zeroIndex + 1 == digit) {
            binary[zeroIndex] = 1;
          }
        });
      });
    copy.set(binary.join(""), obj[objectKey]);
  });
  return copy;
};

const braille = remapNumberKeysToBinary(defaultDic)

console.log(braille);


// Parse the PNG image data into a PNG object

const transformImageChunk = (png) => {
  const accum = ""
  // 2x3 pixel chunks from top left to right bottom corner of an image
  // Get the pixel data from the PNG object
  const pixels = png.data.filter((_, i) => (i + 1) % 4); // filter out alpha channel
  const [width, height] = [png.width, png.height];
  // Loop through the image pixel data and replace it with 
  return accum
};

const pixelChunkToIndex = (pixels) => {
  const r = [];
  for (let i = 0; i < pixels.length; i += 3) {
    // Get the RGBA values for the current pixel
    const red = pixels[i];
    const green = pixels[i + 1];
    const blue = pixels[i + 2];
    if (red + green + blue >= 127 * 3) {
      r.push("1");
    } else {
      r.push("0");
    }
    // if ((i / 3) % width) {
    //   console.log(i);
    //   r.push("\n");
    // }
  }
  return +r.join("");
};

const chunkIndexToBraille = (index) => {
  return braille.get(index);
};

// // Write the modified PNG image data to a file
// const outputData = PNG.sync.write(png);
// fs.writeFileSync("output.png", outputData);
const replaceImage = (img) => {
  const imageData = fs.readFileSync("./assets/1.png"); // img file parsed here
  
  const png = PNG.sync.read(imageData);
}