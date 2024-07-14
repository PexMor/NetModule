#!/usr/bin/env -S python
"""Simple tool for Motorola S-Record files."""

from pathlib import Path

fp = Path().home() / "tmp" / "NetworkModule-MQTT-Home.sx"


def chsum_chk(hex_data: str) -> int:
    bys = bytes.fromhex(hex_data)
    chsum_data = 0
    for no, by in enumerate(bys):
        chsum_data = chsum_data + by
    chsum_data = chsum_data ^ 0xFF & 0xFF
    return chsum_data


def dehex(hex_str: str) -> int:
    return int.from_bytes(bytes.fromhex(hex_str), byteorder="big")


def main():
    # todo: srec_cat FRDM-KL25Z_CRC.srec -crop 0x500 0x530 -Output - -hex-dump
    if not fp.exists():
        raise FileNotFoundError()
    lines = [line.strip() for line in fp.open(encoding="utf-8").readlines()]
    for line in lines:
        if line.startswith("S3"):
            (rec_type, rec_len_str, rec_addr_32_str, data, chsum_str) = (
                line[:2],
                line[2:4],
                line[4:12],
                line[12:-2],
                line[-2:],
            )
            rec_len = dehex(rec_len_str)
            rec_addr_32 = dehex(rec_addr_32_str)
            chsum = dehex(chsum_str)
            csum = chsum_chk(rec_len_str + rec_addr_32_str + data)
            print(
                rec_type,
                rec_len,
                rec_len_str,
                rec_addr_32,
                rec_addr_32_str,
                data,
                chsum,
                chsum_str,
                csum,
            )
        elif line.startswith("S7"):
            print(line)


if __name__ == "__main__":
    main()
