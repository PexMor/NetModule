const data_default = {
  ip: {
    val: "192.168.182.4",
    type: "ip",
    size: 4,
    eeprom_addr: 0,
    color: "#fcc",
    reverse: true,
  },
  port: {
    val: "8080",
    type: "port",
    size: 2,
    eeprom_addr: 5,
    color: "#cfc",
    reverse: true,
  },
  subnet: {
    val: "255.255.255.0",
    type: "ip",
    size: 4,
    eeprom_addr: 8,
    color: "#fcf",
    reverse: true,
  },
  gateway: {
    val: "192.168.182.1",
    type: "ip",
    size: 4,
    eeprom_addr: 13,
    color: "#ffc",
    reverse: true,
  },
  devname: {
    val: "NewDevice000",
    type: "str",
    eeprom_addr: 18,
    padding: 20,
    color: "#ccf",
    reverse: false,
  },
  mac: {
    val: "c2:4d:69:6b:65:00",
    type: "mac",
    size: 6,
    eeprom_addr: 39,
    color: "#cff",
    reverse: true,
  },
  // -------------------
  mqtt_ip: {
    val: "192.168.182.10",
    type: "ip",
    size: 4,
    eeprom_addr: 46,
    color: "#faf",
    reverse: true,
  },
  mqtt_port: {
    val: "1883",
    type: "port",
    size: 2,
    eeprom_addr: 51,
    color: "#afa",
    reverse: true,
  },
  mqtt_user: {
    val: "user",
    type: "str",
    eeprom_addr: 54,
    padding: 20,
    color: "#faa",
    reverse: false,
  },
  mqtt_pass: {
    val: "p4ssw0rd",
    type: "str",
    eeprom_addr: 75,
    padding: 20,
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
const prepEepromImg = (data) => {
  // get ascii value of '|' and fill eeprom_img with it
  //   const ascii_pipe = "|".charCodeAt(0);
  //   eeprom_img.fill(ascii_pipe, 0, eeprom_size);
  eeprom_img.fill(0, 0, eeprom_size);
  for (let key in data) {
    const addr = data_default[key].eeprom_addr;
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
      const color = eeprom_colors[i + j];
      let hex = eeprom_img[i + j].toString(16).padStart(2, "0");
      hex = `<span style="background-color:${color}" title="${
        eeprom_floating_info[i + j]
      }" >${hex}</span>`;
      line.push(hex);
      let ascii =
        eeprom_img[i + j] >= 32 && eeprom_img[i + j] <= 126
          ? String.fromCharCode(eeprom_img[i + j])
          : ".";
      ascii = `<span style="background-color:${color}" title="${
        eeprom_floating_info[i + j]
      }">${ascii}</span>`;
      ascii_line.push(ascii);
    }
    hexdump.push(line.join(" ") + "  " + ascii_line.join(""));
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
  const eeprom_img_b64 = btoa(String.fromCharCode(...eeprom_img));
  const eeprom_img_b64_url =
    "data:application/octet-stream;base64," + eeprom_img_b64;
  const downloadLink = document.createElement("a");
  downloadLink.href = eeprom_img_b64_url;
  downloadLink.download = "eeprom.img";
  // downloadLink.click();
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
