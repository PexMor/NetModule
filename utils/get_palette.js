// ESM
import distinctColors from "distinct-colors";

var palette = distinctColors.default({
  count: 30,
  hueMin: 0,
  hueMax: 360,
  lightMin: 65,
  lightMax: 95,
  chromaMin: 20,
  chromaMax: 60,
});

for (let it of palette) {
  console.log(it.hex());
}
//console.log(palette);
