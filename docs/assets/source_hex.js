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
