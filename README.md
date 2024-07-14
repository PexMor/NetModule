# NetModule

JS Helper application for HW-584 v2

- The Tool itself open <https://pexmor.github.io/NetModule/> - in-browser "local" tool
- <https://github.com/nielsonm236/NetMod-ServerApp> - The alternative firmware for the HW-584v2

## Tools used

- [SRecord](https://srecord.sourceforge.net/) - a CLI for manipulating the files
- [stm8flash](https://github.com/vdudouyt/stm8flash) - a tool used to flash the **STM8** MCUs (SWIM protocol) can use [ST-Link v2](https://www.st.com/en/development-tools/st-link-v2.html)
- [hexdump](https://manpages.debian.org/unstable/bsdextrautils/hexdump.1.en.html) to check the binary
- [stlink](https://github.com/stlink-org/stlink) - a suite of tools for **STM32** make use of [ST-Link v2](https://www.st.com/en/development-tools/st-link-v2.html) _(**Note**: not used for HW-584v2)_

### Hints

To get canonical hexdump (hex + printable ascii) of a file `eeprom.bin`:

```bash
hexdump -C eeprom.bin
```

To show **srecord** file contents:

```bash
srec_info NetworkModule-MQTT-Home.srec
```

gives you this output:

```yaml
Format: Motorola S-Record
Header: "NetworkModule.sm8"
srec_info: NetworkModule-MQTT-Home.srec: 1010:
    warning: data records not in strictly ascending order (expected >= 0xFDD2,
    got 0x4000)
Execution Start Address: FFFFFFFF
Data:   000A - 000F
        4000 - 406D
        8000 - FDD1
```

This original file as the warning and output says is not sorted and contains extra content.

In order to fix it it has to be tweaked as:

- remove the extra segements `000A - 000F` and `4000 - 406D`
- fix the record counter

This can be done manually by:

- removing the records starting with: `S32500004000` up to `S31300004060`
- as well as line starting with `S30B0000000A`
- do not forget to remove control line with number of records `S7`

analysis (based on [Motorola S-Rec wiki page](<https://en.wikipedia.org/wiki/SREC_(file_format)>)):

Command `cut -c-2 NetworkModule-MQTT-Home.sx | sort | uniq -c` reveals that it has:

- 1 `S0` (Header) record
- 1013 `S3` (data 32-bit address) records
- 1 `S7` (Start address 32-bit) record.

Where the `S3` data records consists of numerous fields.

For example (the first code record):

`S3250000800082009E0D820000008200000082000000820000008200000082000000820000009F`

splits into:

- `S3` type string
- `25` length in bytes
- `00008000` address field (not included in length)
- `82009E0D82000000820000008200000082000000820000008200000082000000` data field
- `9F` - checksum field

let's try to parse it with Python see [p01_parse.py](p01_parse.py)

Example file from: <https://github.com/nielsonm236/NetMod-ServerApp/releases/download/20240612.0226/NetworkModule-MQTT-Home.sx>

```bash
srec_cat NetworkModule-MQTT-Home.sx | cut -c-2 | sort | uniq -c
```

yields (note added `S5` data count record):

```text
srec_cat: NetworkModule-MQTT-Home.sx: 1010: warning: data records not in
    strictly ascending order (expected >= 0xFDD2, got 0x4000)
      1 S0
   1012 S1
      1 S5
      1 S7
```

based on:

```bash
srec_info NetworkModule-MQTT-Home.sx
```

```text
Format: Motorola S-Record
Header: "NetworkModule.sm8"
srec_info: NetworkModule-MQTT-Home.sx: 1010: warning: data records not in
    strictly ascending order (expected >= 0xFDD2, got 0x4000)
Execution Start Address: FFFFFFFF
Data:   000A - 000F
        4000 - 406D
        8000 - FDD1
```

we can cut the desired adress range `8000 - FDD1` the code (note: `0xfdd2` which is last address `+1`):

```bash
srec_cat NetworkModule-MQTT-Home.sx -crop 0x8000 0xfdd2 | srec_info
```

which can be simplified as:

```bash
srec_cat NetworkModule-MQTT-Home.sx -crop 0x8000 | sort | uniq -c
```

Without the `data_count`

```bash
srec_cat NetworkModule-MQTT-Home.sx -crop 0x8000 -disable=data-count -address‐length=4 | cut -c-2 | sort | uniq -c
```

which gives:

```text
srec_cat: NetworkModule-MQTT-Home.sx: 1010: warning: data records not in
    strictly ascending order (expected >= 0xFDD2, got 0x4000)
      1 S0
   1007 S1
      1 S7
```

```bash
# we can omit also the start address but it is not needed
# srec_cat NetworkModule-MQTT-Home.sx -motorola -crop 0x8000 -address-length=4 -disable=exec-start-address -disable=data-count | tee ~/tmp/final.srec
srec_cat NetworkModule-MQTT-Home.sx -motorola -crop 0x8000 -address-length=4 -disable=data-count | tee ~/tmp/final.srec
```

Final result gives:

```bash
srec_info ~/tmp/final.srec
```

then the output turn into:

```yaml
Format: Motorola S-Record
Header: "NetworkModule.sm8"
Execution Start Address: FFFFFFFF
Data: 8000 - FDD1
```

ready to be flashed, compare that to the original file, which also has the code block split into two parts the first one contains constants (a html, etc.) and the seconds is the actual code.

### Advance srec_cat

Example taken from <https://mcuoneclipse.com/2015/04/26/crc-checksum-generation-with-srecord-tools-for-gnu-and-eclipse/> to show how the srec_cat can be used.

```bash
# srec_cat command file to add the CRC and produce application file to be flashed
# Usage: srec_cat @filename

# first: create CRC checksum
FRDM-KL25Z_CRC.srec                # input file
-fill 0xFF 0x0410 0x20000          # fill code area with 0xff
-crop 0x0410 0x1FFFE               # just keep code area for CRC calculation below (CRC will be at 0x1FFFE..0x1FFFF)
-CRC16_Big_Endian 0x1FFFE -CCITT   # calculate big endian CCITT CRC16 at given address.
-crop 0x1FFFE 0x20000              # keep the CRC itself

# second: add application file
FRDM-KL25Z_CRC.srec                # input file
-fill 0xFF 0x0410 0x1FFFE          # fill code area with 0xff

# finally, produce the output file
-Output                            # produce output
FRDM-KL25Z_CRC_Added.srec
```
