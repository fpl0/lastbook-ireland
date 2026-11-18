#!/bin/zsh
# Downloads the offline libraries (official Kiwix ZIM files) into the Lastbook data folder and verifies checksums.
LIB="$HOME/Library/Application Support/Lastbook Ireland/zim"; mkdir -p "$LIB"; cd "$LIB"
BASE=https://download.kiwix.org/zim
FILES=(
 other/zimgit-post-disaster_en_2024-05.zim
 other/zimgit-medicine_en_2024-08.zim
 other/zimgit-water_en_2024-08.zim
 other/zimgit-food-preparation_en_2025-04.zim
 other/zimgit-knots_en_2024-08.zim
 zimit/irp.fas.org_en_military-medicine_2026-10.zim
 zimit/nhs.uk_en_medicines_2026-09b.zim
 wikipedia/wikipedia_en_medicine_maxi_2026-10.zim
 other/appropedia_en_all_maxi_2026-02.zim
 other/gardenology.org_en_all_2026-09.zim
 wikivoyage/wikivoyage_en_all_maxi_2026-06.zim
 ifixit/ifixit_en_all_2025-12.zim
 wikibooks/wikibooks_en_all_maxi_2026-10.zim
 wikipedia/wikipedia_en_top_maxi_2026-09.zim
 zimit/internet-encyclopedia-philosophy_en_all_2026-05.zim
 zimit/cd3wdproject.org_en_all_2026-11.zim
 other/energypedia_en_all_maxi_2026-06.zim
 libretexts/libretexts.org_en_workforce_2026-01.zim
 libretexts/libretexts.org_en_eng_2025-01.zim
 libretexts/libretexts.org_en_med_2025-01.zim
 libretexts/libretexts.org_en_socialsci_2025-01.zim
 libretexts/libretexts.org_en_chem_2025-01.zim
 libretexts/libretexts.org_en_phys_2026-01.zim
 libretexts/libretexts.org_en_bio_2025-01.zim
 libretexts/libretexts.org_en_math_2026-01.zim
)
dl() { f=$(basename $1); [[ -f $f.ok ]] && return; curl -sSL -C - --retry 10 --retry-delay 5 -o $f "$BASE/$1" && curl -sSL "$BASE/$1.sha256" -o $f.sha256 && \
  if shasum -a 256 -c $f.sha256 >/dev/null 2>&1; then touch $f.ok; echo "OK $f"; else echo "CHECKSUM FAIL $f"; fi; }
for p in $FILES; do while (( $(jobs -r | wc -l) >= 4 )); do sleep 2; done; dl $p & done; wait; echo ALLDONE
