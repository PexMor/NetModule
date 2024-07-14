// taken from: hexdump -C eeprom.bin
const source_hex = [
  "00000000  4e 65 77 44 65 76 69 63  65 30 30 30 00 00 00 00  |NewDevice000....|",
  "00000010  00 00 00 00 01 01 f5 00  65 6b 69 4d c2 1f 90 00  |........ekiM....|",
  "00000020  ff ff ff 01 01 a8 c0 04  01 a8 c0 f0 0f ee 55 07  |..............U.|",
  "00000030  5b 00 00 00 00 00 00 00  00 00 00 00 00 00 00 00  |[...............|",
  "00000040  00 00 00 00 00 00 00 00  00 00 00 00 00 00 00 00  |................|",
];
// position in eeprom based on:
// https://github.com/nielsonm236/NetMod-ServerApp/blob/master/NetworkModule/Main.c
const data_default = {
  ip: {
    val: "192.168.182.4",
    type: "ip",
    size: 4,
    eeprom_addr: 40,
    color: "#fcc",
    reverse: true,
  },
  port: {
    val: "8080",
    type: "port",
    size: 2,
    eeprom_addr: 30,
    color: "#cfc",
    reverse: true,
  },
  subnet: {
    val: "255.255.255.0",
    type: "ip",
    size: 4,
    eeprom_addr: 32,
    color: "#fcf",
    reverse: true,
  },
  gateway: {
    val: "192.168.182.1",
    type: "ip",
    size: 4,
    eeprom_addr: 36,
    color: "#ffc",
    reverse: true,
  },
  devname: {
    val: "NewDevice000",
    type: "str",
    eeprom_addr: 0,
    padding: 20,
    color: "#ccf",
    reverse: false,
  },
  mac: {
    val: "c2:4d:69:6b:65:00",
    type: "mac",
    size: 6,
    eeprom_addr: 24,
    color: "#cff",
    reverse: true,
  },
  // -------------------
  mqtt_ip: {
    val: "192.168.182.10",
    type: "ip",
    size: 4,
    eeprom_addr: 50,
    color: "#faf",
    reverse: true,
  },
  mqtt_port: {
    val: "1883",
    type: "port",
    size: 2,
    eeprom_addr: 48,
    color: "#afa",
    reverse: true,
  },
  mqtt_user: {
    val: "user",
    type: "str",
    eeprom_addr: 54,
    padding: 11,
    color: "#faa",
    reverse: false,
  },
  mqtt_pass: {
    val: "p4ssw0rd",
    type: "str",
    eeprom_addr: 65,
    padding: 11,
    color: "#ccc",
    reverse: false,
  },
};
const eeprom_size = 1024;
const eeprom_img = new Uint8Array(eeprom_size);
// list expected commands
const expected_commands = [
  "# read main flash from stm8s105s6",
  "stm8flash -c stlinkv2 -p stm8s105s6 -r flash-read.img -s flash",
  "# flash main flash to stm8s105s6",
  "stm8flash -c stlinkv2 -p stm8s105s6 -w flash.img -s flash",
  "# flash eeprom.img to stm8s105s6",
  "stm8flash -c stlinkv2 -p stm8s105s6 -w eeprom.img -s eeprom",
  "# read eeprom.img from stm8s105s6",
  "stm8flash -c stlinkv2 -p stm8s105s6 -r eeprom-read.img -s eeprom",
];
let eeprom_colors = [];
let eeprom_floating_info = [];
// const dbg_offset = 0x10 * 8;
const dbg_offset = 0;
const prepEepromImg = (data) => {
  // get ascii value of '|' and fill eeprom_img with it
  //   const ascii_pipe = "|".charCodeAt(0);
  //   eeprom_img.fill(ascii_pipe, 0, eeprom_size);
  eeprom_img.fill(0, 0, eeprom_size);
  // load the source_hex into the EEPROM image
  for (let hexrow of source_hex) {
    let arr = hexrow.split(/\s+/);
    // "00000000  4e 65 77 44 65 76 69 63  65 30 30 30 00 00 00 00  |NewDevice000....|",
    let addr = parseInt(arr[0], 16);
    for (let ii = 1; ii < arr.length - 1; ii++) {
      let val = parseInt(arr[ii], 16);
      eeprom_img[addr + ii] = val;
    }
  }
  for (let key in data) {
    const addr = data_default[key].eeprom_addr + dbg_offset;
    const type = data_default[key].type;
    const padding = data_default[key].padding;
    const reverse = data_default[key].reverse;
    const val = data[key];
    let val_bytes = [];
    if (type === "ip") {
      val_bytes = val.split(".").map((v) => parseInt(v));
      if (reverse) val_bytes = val_bytes.reverse();
    } else if (type === "port") {
      val_bytes = [parseInt(val) >> 8, parseInt(val) & 0xff];
      if (reverse) val_bytes = val_bytes.reverse();
    } else if (type === "mac") {
      val_bytes = val.split(":").map((v) => parseInt(v, 16));
      if (reverse) val_bytes = val_bytes.reverse();
    } else if (type === "str") {
      val_bytes = Array.from(val.padEnd(padding, "\0")).map((v) =>
        v.charCodeAt(0)
      );
      // no reverse for str
    }
    val_bytes.forEach((byte, i) => {
      eeprom_img[addr + i] = byte;
    });
  }
};

const makeEepromImg = (data) => {
  const hexdump = [];
  eeprom_colors = [];
  eeprom_floating_info = [];
  // fill eeprom_colors with color up to eeprom_size
  for (let addr = 0; addr < eeprom_size; addr++) {
    eeprom_colors.push("#fff");
    eeprom_floating_info.push("");
  }
  for (let key in data_default) {
    const color = data_default[key].color;
    const eeprom_addr = data_default[key].eeprom_addr;
    let no_bytes = 0;
    if ("padding" in data_default[key]) {
      no_bytes = data_default[key].padding;
    } else {
      no_bytes = data_default[key].size;
    }
    for (let i = 0; i < no_bytes; i++) {
      eeprom_colors[eeprom_addr + i] = color;
      let toShow = `${key}: ${data[key]}`;
      // check if key matches any of the following
      if (["ip", "subnet", "gateway", "mqtt_ip"].includes(key)) {
        // convert to to hex
        toShow += `(${data[key]
          .split(".")
          .map((v) => parseInt(v).toString(16).padStart(2, "0"))
          .join(".")})`;
      } else if (["port", "mqtt_port"].includes(key)) {
        // convert to to hex
        toShow += "(" + parseInt(data[key]).toString(16).padStart(4, "0") + ")";
      }
      eeprom_floating_info[eeprom_addr + i] = toShow;
    }
  }
  for (let i = 0; i < eeprom_size; i += 16) {
    const line = [];
    const ascii_line = [];
    for (let j = 0; j < 16; j++) {
      let addr = i + j;
      let color = eeprom_colors[addr];
      // used for offseted debugging the eeprom contents
      // if (addr >= dbg_offset) {
      //   color = eeprom_colors[addr - dbg_offset];
      // }
      let hex = eeprom_img[addr].toString(16).padStart(2, "0");
      hex = `<span style="background-color:${color}" title="${eeprom_floating_info[addr]}" >${hex}</span>`;
      line.push(hex);
      let ascii =
        eeprom_img[addr] >= 32 && eeprom_img[addr] <= 126
          ? String.fromCharCode(eeprom_img[addr])
          : ".";
      ascii = `<span style="background-color:${color}" title="${eeprom_floating_info[addr]}">${ascii}</span>`;
      ascii_line.push(ascii);
    }
    hexdump.push(
      i.toString(16).padStart(4, "0") +
        " " +
        line.join(" ") +
        "  " +
        ascii_line.join("")
    );
  }
  return hexdump;
};

const showHexDump = (data) => {
  prepEepromImg(data);
  // create hexdump of eeprom_img split by 16 bytes per line
  hexdump = makeEepromImg(data);
  // output to eeprom_div
  const eeprom_div = document.getElementById("eeprom_div");
  eeprom_div.innerHTML = hexdump.join("<br>");
};

const onUpdateBut = () => {
  // iterate over input fileds and save their values to dictionary and that dictionary to local storage
  const inputs = document.querySelectorAll("input");
  const dataValues = getDataFromForm(inputs);
  showHexDump(dataValues);
  localStorage.setItem("dataStorage", JSON.stringify(dataValues));
};

const onDownloadBut = () => {
  const eeprom_img_b64 = btoa(String.fromCharCode(...eeprom_img));
  const eeprom_img_b64_url =
    "data:application/octet-stream;base64," + eeprom_img_b64;
  const downloadLink = document.createElement("a");
  downloadLink.href = eeprom_img_b64_url;
  downloadLink.download = "eeprom.img";
  downloadLink.click();
  // wait for download to finish and then remove the link
  setTimeout(() => {
    downloadLink.remove();
    downloadLink.parentNode.removeChild(downloadLink);
  }, 1000);
};
const onResetBut = () => {
  const inputs = document.querySelectorAll("input");
  let data = {};
  inputs.forEach((input) => {
    input.value = data_default[input.id].val;
    data[input.id] = data_default[input.id].val;
  });
  localStorage.setItem("dataStorage", JSON.stringify(data));
  showHexDump(data);
};
const onLoad = () => {
  const updateBut = document.getElementById("updateBut");
  updateBut.addEventListener("click", onUpdateBut);
  const resetBut = document.getElementById("resetBut");
  resetBut.addEventListener("click", onResetBut);
  const downloadBut = document.getElementById("downloadBut");
  downloadBut.addEventListener("click", onDownloadBut);
  const dataStorage = JSON.parse(localStorage.getItem("dataStorage"));
  let data = {};
  const inputs = document.querySelectorAll("input");
  inputs.forEach((input) => {
    if (dataStorage && dataStorage[input.id]) {
      input.value = dataStorage[input.id];
      data[input.id] = dataStorage[input.id];
    } else {
      input.value = data_default[input.id].val;
      data[input.id] = data_default[input.id].val;
    }
    input.style.backgroundColor = data_default[input.id].color;
  });
  showHexDump(data);
  // save expected commands to div commands
  const commands_div = document.getElementById("commands");
  commands_div.innerHTML = expected_commands.join("<br>");
};

window.addEventListener("load", onLoad);
const getDataFromForm = (inputs) => {
  const data = {};
  inputs.forEach((input) => {
    data[input.id] = input.value;
  });
  return data;
};
