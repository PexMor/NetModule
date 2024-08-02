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
// In order to compare side by side the original eeprom image
// with the one generated by this script
// const dbg_offset = 0x10 * 8;
const dbg_offset = 0;
const getInputsFromDataForm = () => {
  const inputs = [];
  for (let key in data_default) {
    let input = document.getElementById(key);
    inputs.push(input);
  }
  return inputs;
};
const computeChecksum = (data) => {
  let sum = 0;
  for (let ii = 0; ii < data.length; ii++) {
    sum += data[ii];
  }
  sum = (sum ^ 0xff) & 0xff;
  return sum;
};
const srecTypes = {
  S0: "header record",
  S1: "data record, 16-bit address",
  S2: "data record, 24-bit address",
  S3: "data record, 32-bit address",
  S4: "reserved",
  S5: "record count, 16-bit",
  S6: "record count, 24-bit",
  S7: "start address record, 32-bit",
  S8: "start address record, 24-bit",
  S9: "start address record, 16-bit",
};
const is_overlapping = (a_start, a_end, b_start, b_end) => {
  // check if two intervals are overlapping
  let overlap = false;
  if (a_start <= b_end && b_start <= a_end) {
    // |---a---|
    //     |---b---|
    overlap = true;
  } else if (b_start <= a_end && a_start <= b_end) {
    //     |---a---|
    // |---b---|
    overlap = true;
  } else if (a_start <= b_start && a_end >= b_end) {
    // |---a--------|
    //   |---b---|
    overlap = true;
  } else if (b_start <= a_start && b_end >= a_end) {
    //   |---a---|
    // |---b--------|
    overlap = true;
  }
  return overlap;
};
const merge_ranges = (ranges) => {
  // merge overlapping ranges
  ranges.sort((a, b) => a[0] - b[0]);
  // add first range to merged_ranges
  let merged_ranges = [];
  let first_range = ranges.shift();
  merged_ranges.push({ s: first_range[0], e: first_range[1] });
  for (let range of ranges) {
    let start = range[0];
    let end = range[1];
    let updated = false;
    let new_merged_ranges = [];
    for (let idx = 0; idx < merged_ranges.length; idx++) {
      let m_start = merged_ranges[idx].s;
      let m_end = merged_ranges[idx].e;
      if (is_overlapping(start, end, m_start, m_end)) {
        // get new start and end
        start = Math.min(start, m_start);
        end = Math.max(end, m_end);
        updated = true;
      } else {
        new_merged_ranges.push({ s: m_start, e: m_end });
      }
    }
    new_merged_ranges.push({ s: start, e: end });
    new_merged_ranges.sort((a, b) => a.s - b.e);
    merged_ranges = new_merged_ranges;
  }
  return merged_ranges.map((v) => [v.s, v.e]);
};
const readSrecFormat = (srec_str) => {
  // read srec file and convert to eeprom_img
  // convert srec format to eeprom_img
  // Example: S214000000004e657744657669636530303
  // S01400004E6574776F726B4D6F64756C652E736D3855
  let tmp_eeprom_img = new Uint8Array(eeprom_size);
  const srec_lines = srec_str.split(/\r?\n/);
  // iterate over srec lines and convert to eeprom_img
  let type_counter = {};
  let address_ranges = [];
  // get address offset
  let addr_offset = parseInt(document.getElementById("address").value, 16);
  for (let data_line of srec_lines) {
    data_line = data_line.trim();
    if (data_line === "") continue;
    // get data from srec line
    const record_type = data_line.slice(0, 2);
    if (record_type in type_counter) {
      type_counter[record_type] += 1;
    } else {
      type_counter[record_type] = 1;
    }
    let has_data = false;
    let data_len = undefined;
    let addr = undefined;
    let data_hex = undefined;
    let data_bytes = undefined;
    if (record_type === "S0") {
      // header record
    } else if (record_type === "S1") {
      // data record, 16-bit address
      // structure of data record
      // S1 14 0000 4e657744657669636530303 xx
      // |  |  |    |                       |
      // |  |  |    |                       checksum
      // |  |  |    data
      // |  |  address 16-bit
      // |  data length (address+data+chesum)
      // record type
      data_len = parseInt(data_line.slice(2, 4), 16);
      addr = parseInt(data_line.slice(4, 8), 16);
      data_hex = data_line.slice(8, -2);
      data_bytes = data_hex.match(/.{2}/g).map((v) => parseInt(v, 16));
      has_data = true;
    } else if (record_type === "S2") {
      // data record, 24-bit address
      // structure of data record
      // S2 14 000000 4e657744657669636530303 xx
      // |  |  |      |                       |
      // |  |  |      |                       checksum
      // |  |  |      data
      // |  |  address 24-bit
      // |  data length (address+data+chesum)
      // record type
      data_len = parseInt(data_line.slice(2, 4), 16);
      addr = parseInt(data_line.slice(4, 10), 16);
      data_hex = data_line.slice(10, -2);
      data_bytes = data_hex.match(/.{2}/g).map((v) => parseInt(v, 16));
      has_data = true;
    } else if (record_type === "S3") {
      // data record, 32-bit address
      // structure of data record
      // S1 14 00000000 4e657744657669636530303 xx
      // |  |  |        |                       |
      // |  |  |        |                       checksum
      // |  |  |        data
      // |  |  address 32-bit
      // |  data length (address+data+chesum)
      // record type
      data_len = parseInt(data_line.slice(2, 4), 16);
      addr = parseInt(data_line.slice(4, 12), 16);
      data_hex = data_line.slice(12, -2);
      data_bytes = data_hex.match(/.{2}/g).map((v) => parseInt(v, 16));
      has_data = true;
    }
    if (!has_data) {
      continue;
    }
    // convert data to eeprom_img
    let cvt_addr = addr - addr_offset;
    for (let ii = 0; ii < data_bytes.length; ii++) {
      tmp_eeprom_img[cvt_addr + ii] = data_bytes[ii];
    }
    // save address range
    address_ranges.push([addr, addr + data_bytes.length]);
  }
  merged_ranges = merge_ranges(address_ranges);
  let elFileInfo = document.getElementById("file-info");
  let fileInfo = [];
  for (let key in type_counter) {
    fileInfo.push(
      `<tr><th>${srecTypes[key]}</th><td>(${key})</td><td>${type_counter[key]}</td></tr>`
    );
  }
  let html = "<table id='file-info'>" + fileInfo.join("\n") + "</table>";
  html += "<h4>Merged address ranges</h4>";
  html += "<p>All addresses are displayed in hexadecimal</p>";
  html += "<table>";
  for (let range of merged_ranges) {
    html += `<tr><td>${range[0].toString(
      16
    )}</td><td>..</td><td>${range[1].toString(16)}</td><td>len: ${
      range[1] - range[0]
    } (0x${(range[1] - range[0]).toString(16)})</td></tr>`;
  }
  html += "</table>";
  elFileInfo.innerHTML = html;
  // console.log(tmp_eeprom_img);
  // showHexDump(dataValues);
  // localStorage.setItem("dataStorage", JSON.stringify(dataValues));
};
const makeSrecFormat = (header_str, eol_style, addr_offset) => {
  // console.log("makeSrecFormat", header_str, eol_style, addr_offset);
  // convert eeprom_img to srec format
  // Example: S214000000004e657744657669636530303
  // S01400004E6574776F726B4D6F64756C652E736D3855
  let srec_lines = [];
  // convert header_str to bytes and then to hex
  let header_bytes = header_str.split("").map((v) => v.charCodeAt(0));
  let header_hex = header_bytes
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
  // compute lenght of header
  let len = header_bytes.length + 2 + 1; /* dummy address length, check sum */
  let makeHdrs = `${len.toString(16).padStart(2, "0")}0000${header_hex}`;
  let forCheckSum_bytes = makeHdrs.match(/.{2}/g).map((v) => parseInt(v, 16));
  let checksum = computeChecksum(forCheckSum_bytes);
  let checksum_str = checksum.toString(16).padStart(2, "0");
  // prepend the makeHdrs with S0 and len
  let srec_hdr = `S0${makeHdrs}${checksum_str}`;
  srec_lines.push(srec_hdr);
  // S1,str-len,address-32bit,data,checksum
  const chunk_size = 32;
  for (let addr_rel = 0; addr_rel < eeprom_size; addr_rel += chunk_size) {
    let data = [];
    let addr = addr_rel + addr_offset;
    for (let ii = 0; ii < chunk_size; ii++) {
      data.push(eeprom_img[addr_rel + ii]);
    }
    let data_hex = data.map((v) => v.toString(16).padStart(2, "0")).join("");
    let len = data.length + 4 + 1; /* dummy address length, check sum */
    let addr_hex = addr.toString(16).padStart(8, "0");
    makeHdrs = `${len.toString(16).padStart(2, "0")}${addr_hex}${data_hex}`;
    forCheckSum_bytes = makeHdrs.match(/.{2}/g).map((v) => parseInt(v, 16));
    checksum = computeChecksum(forCheckSum_bytes);
    checksum_str = checksum.toString(16).padStart(2, "0");
    srec_hdr = `S3${makeHdrs}${checksum_str}`;
    srec_lines.push(srec_hdr);
  }
  if (eol_style === "crlf") {
    return srec_lines.join("\r\n").toUpperCase();
  } else {
    return srec_lines.join("\n").toUpperCase();
  }
};
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
  // 00004E6574776F726B4D6F64756C652E736D3855
  // 00004E65744D6F64756C652D656570726F6D2D636F6E666967FE
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
  const inputs = getInputsFromDataForm();
  const dataValues = getDataFromForm(inputs);
  showHexDump(dataValues);
  localStorage.setItem("dataStorage", JSON.stringify(dataValues));
};

const onDownloadBut = () => {
  const file_type = document.getElementById("filetype").value;
  let eeprom_img_b64;
  if (file_type === "srec") {
    const eol_style = document.getElementById("lineending").value;
    // get header string
    let hdr_str = document.getElementById("header").value;
    // get address offset
    let addr_offset = parseInt(document.getElementById("address").value, 16);
    // make srec file textual format
    let srec_str = makeSrecFormat(hdr_str, eol_style, addr_offset);
    // console.log(srec_str);
    eeprom_img_b64 = btoa(srec_str);
    // eeprom_img_b64 = btoa(String.fromCharCode(...eeprom_img));
  } else {
    // make binary file
    eeprom_img_b64 = btoa(String.fromCharCode(...eeprom_img));
  }
  const eeprom_img_b64_url =
    "data:application/octet-stream;base64," + eeprom_img_b64;
  const downloadLink = document.createElement("a");
  downloadLink.href = eeprom_img_b64_url;
  let file_name_stem = document.getElementById("filestem").value;
  // add timestamp to file name
  let now_iso = new Date().toISOString();
  // remove milliseconds part of the iso string
  now_iso = now_iso.replace(/\.\d+Z$/, "Z");
  file_name_stem += "-" + now_iso.replace(/[:-]/g, "").replace(/T/, "-");
  if (file_type === "srec") {
    downloadLink.download = file_name_stem + ".srec";
  } else {
    downloadLink.download = file_name_stem + ".img";
  }
  console.log(downloadLink.download);
  downloadLink.click();
  // wait for download to finish and then remove the link
  setTimeout(() => {
    downloadLink.remove();
    downloadLink.parentNode.removeChild(downloadLink);
  }, 1000);
};
const onResetBut = () => {
  const inputs = getInputsFromDataForm();
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
  // copyBut
  const copyBut = document.getElementById("copyBut");
  copyBut.addEventListener("click", () => {
    const eeprom_div = document.getElementById("eeprom_div");
    const range = document.createRange();
    range.selectNode(eeprom_div);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    document.execCommand("copy");
    window.getSelection().removeAllRanges();
  });
  // file input
  const fileInput = document.getElementById("file");
  fileInput.addEventListener("change", (event) => {
    const file = event.target.files[0];
    parseFile(file);
  });
  // uploadBut
  const uploadBut = document.getElementById("uploadBut");
  uploadBut.addEventListener("click", (event) => {
    const fileInput = document.getElementById("file");
    const file = fileInput.files[0];
    parseFile(file);
  });
  const hideShowHexDumpBut = document.getElementById("hideShowHexDumpBut");
  hideShowHexDumpBut.addEventListener("click", () => {
    const eeprom_div = document.getElementById("eeprom_div");
    if (eeprom_div.style.display === "none") {
      hideShowHexDumpBut.innerText = "Hide EEPROM Hexdump";
      eeprom_div.style.display = "";
    } else {
      hideShowHexDumpBut.innerText = "Show EEPROM Hexdump";
      eeprom_div.style.display = "none";
    }
  });
  const dataStorage = JSON.parse(localStorage.getItem("dataStorage"));
  let data = {};
  const inputs = getInputsFromDataForm();
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
function parseFile(file) {
  const reader = new FileReader();
  reader.onload = (event) => {
    const srec_str = event.target.result;
    if (srec_str.startsWith("S")) {
      // srec format
      console.log("srec format");
      readSrecFormat(srec_str);
    } else if (srec_str.startsWith(":")) {
      // hex format
      console.log("hex format");
    } else {
      console.error("Unknown format");
    }
  };
  reader.readAsText(file);
}
