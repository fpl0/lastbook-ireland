/* Additional field guides + the "go deeper" map that links every guide into the offline libraries.
   deep.wiki: encyclopedia articles ("med:" = WikiMed, "wp:" = Wikipedia top articles, "voy:" = Wikivoyage)
   deep.docs: full-text queries run live against the survival manuals and official guidance (page-level hits)
   deep.lib:  free-text query run live against the Kiwix libraries */
(function () {
const more = [
{ id:"bleeding", group:"First aid", title:"Severe bleeding & wounds",
  summary:"Stop life-threatening bleeding, tourniquets, cleaning wounds and spotting infection when help is far away.",
  html:`
<div class="callout red"><b>Life-threatening bleeding kills in minutes.</b> Call 112/999 (or get someone to), then act — don't wait.</div>
<ol class="steps">
<li><b>Press hard</b> directly on the wound with a pad, cloth or your hand (gloves if you have them). Keep pressing for at least 10 minutes without peeking.</li>
<li><b>Pack deep wounds</b> (groin, armpit, neck) — push gauze or clean cloth right into the wound and keep firm pressure on top.</li>
<li><b>Limb bleeding that won't stop:</b> apply a tourniquet 5–7 cm above the wound (not on a joint), tighten until the bleeding stops, note the time and write it on the person. Never loosen it once on — that's for the hospital.</li>
<li><b>Treat for shock:</b> lie them down, keep them warm (insulate from the ground), raise legs if no leg or pelvic injury. Nothing to eat or drink.</li>
</ol>
<h3>Cleaning wounds when help is delayed</h3>
<ul>
<li>Wash your hands. Irrigate the wound with plenty of clean (boiled-then-cooled or drinkable) water under pressure — a clean plastic bag with a pin-hole or a syringe works. This matters more than antiseptic.</li>
<li>Remove visible dirt. Leave deeply embedded objects in place and pad around them.</li>
<li>Cover with a clean, non-stick dressing. Change daily or when soaked.</li>
<li><b>Don't close</b> wounds that are dirty, are bites, are deep punctures or are more than ~6–8 hours old — closing traps infection. Leave them open and dressed.</li>
</ul>
<h3>Infection — watch for</h3>
<p>Spreading redness, heat, swelling, pus, red streaks up the limb, fever, or feeling very unwell. Sepsis signs (confusion, fast breathing, mottled or very pale skin, no urine for a day) are an emergency. Tetanus risk after soil or rust wounds if not vaccinated in 10 years.</p>`},
{ id:"lost", group:"Outdoors", title:"Lost, stranded or cut off",
  summary:"Stop, stay found, signal, and stay warm until rescue reaches you.",
  html:`
<ol class="steps">
<li><b>Stop.</b> Sit down, drink, eat something, think. Most bad outcomes start with a rushed decision.</li>
<li><b>Call 112/999</b> if you have any signal — even one bar. Text if calls fail. Give your grid reference from the <a href="#/now">Now</a> tab.</li>
<li><b>Stay put</b> if someone knows your route, if you're injured, or in fog/darkness. Rescuers search planned routes first.</li>
<li><b>Get out of the wind and wet</b>: put on every layer, sit on your pack or a mat, huddle together, use a survival bag.</li>
<li><b>Signal</b>: six whistle blasts or torch flashes, pause a minute, repeat (international mountain distress). Three of anything means help. Bright clothing laid out, ground-to-air "V" (assistance) or "X" (medical).</li>
</ol>
<p>If you must move: follow a known bearing downhill to a track, wall, fence or stream — but avoid following streams into gorges and cliffs. In the bog, keep to firm heather and avoid bright-green moss.</p>`},
{ id:"shelter", group:"Survival", title:"Shelter, warmth & fire",
  summary:"Staying warm and dry outside — insulation first, then fire safety.",
  html:`
<p>In Ireland's climate the main killer outdoors is <b>wet + wind</b>, not frost. Priorities: get out of the wind, get insulated from the ground, stay dry.</p>
<ul>
<li>Use what's there: a wall, a hedge bank, a ditch on the lee side, dense conifers, a ruin. Avoid hollows that collect cold air and water, and anything under dead branches.</li>
<li>Insulate from the ground with a thick layer (30 cm compressed) of dry bracken, heather, rushes, spruce boughs, or your pack and rope.</li>
<li>A tarp or bivvy bag pitched low and small heats faster. Debris huts work: a ridge pole, a ribbed frame, then a thick (60 cm+) layer of leaves/bracken.</li>
<li>Fire: clear a patch to bare soil, away from overhangs, peat and dry gorse. Peat/bog fires can burn underground for days — don't light fires on bog. Keep water nearby. Never use fire or stoves inside a closed tent or vehicle (carbon monoxide).</li>
<li>Tinder that works when wet: birch bark, the inside of dead gorse/hazel, cotton wool with Vaseline, fatwood. Split wet sticks to reach dry centres.</li>
</ul>`},
{ id:"navigation", group:"Outdoors", title:"Navigation without GPS",
  summary:"Map and compass, Irish grid references, finding north from the sun and stars.",
  html:`
<h3>Grid references</h3>
<p>Irish maps use the <b>Irish Grid</b> (OSi Discovery / OSNI, e.g. <code>V 803 844</code>) and newer <b>ITM</b> coordinates. Read <i>along the corridor, then up the stairs</i>: eastings first, then northings. The Map tab shows both for any point you tap.</p>
<h3>Map & compass</h3>
<ol class="steps">
<li>Lay the compass edge from where you are to where you want to go.</li>
<li>Turn the housing so its lines run parallel with the grid's north lines (orienting arrow to map north).</li>
<li>Magnetic variation in Ireland is small (about 1–2° west, decreasing) — at walking distances you can usually ignore it.</li>
<li>Hold the compass flat, turn yourself until the needle sits in the arrow ("red in the shed"), and walk along the direction-of-travel arrow, aiming at landmarks.</li>
</ol>
<h3>Without a compass</h3>
<ul>
<li>The sun is roughly due south at 13:00 Irish summer time (12:00 in winter).</li>
<li>Polaris (the North Star) — follow the two "pointer" stars of the Plough (Big Dipper) about five times their spacing.</li>
<li>Prevailing winds are south-westerly: lone trees on exposed ground often lean north-east.</li>
</ul>`},
{ id:"medicines", group:"First aid", title:"Medicines when the pharmacy is closed",
  summary:"Stocking common medicines, safe doses, and the full NHS medicines A–Z offline.",
  html:`
<ul>
<li>Keep at least 2 weeks of any prescription medicine; ask your GP about an emergency supply if a crisis is expected. Keep a written list of everyone's medicines, doses and allergies (Toolkit → Plan).</li>
<li>Household basics: paracetamol, ibuprofen (not for everyone), antihistamine, oral rehydration sachets, loperamide, hydrocortisone cream, antiseptic, a thermometer.</li>
<li><b>Paracetamol overdose is easy and dangerous</b> — many cold/flu products contain it. Adults: never more than 4 g (8 × 500 mg) in 24 hours; less if under 50 kg, a heavy drinker, or liver disease. Children: dose by age/weight on the pack.</li>
<li>Don't share prescription medicines. Keep insulin cool (it lasts about a month at room temperature once opened).</li>
<li>Poisons Information Centre (Republic): 01 809 2166 (8am–10pm). In an emergency call 112/999.</li>
</ul>
<p>The <b>NHS Medicines A–Z</b> in the Library covers dosing, side effects and interactions for over 1,300 medicines.</p>`},
{ id:"childbirth", group:"First aid", title:"Emergency childbirth",
  summary:"When the baby won't wait: what to do until the ambulance or midwife arrives.",
  html:`
<div class="callout red">Call 112/999 — the call-taker will talk you through it. Most births go well on their own; your job is to keep mother and baby warm and calm.</div>
<ol class="steps">
<li>Wash hands. Put down clean towels/sheets. Keep the room warm.</li>
<li>Let the mother find her position. Don't pull on the baby or try to delay the birth.</li>
<li>As the head comes, support it gently. If the cord is around the neck, slip it over the head gently.</li>
<li>After birth: dry the baby, place skin-to-skin on the mother's chest, cover both with a dry towel and a hat for the baby.</li>
<li>If the baby isn't breathing: rub the back firmly with a towel; if still not breathing, start infant CPR (see CPR guide).</li>
<li>No need to cut the cord quickly — leave it until help arrives. The placenta usually comes within 30 minutes; keep it in a bag for the midwife.</li>
<li>Heavy bleeding after birth: rub firmly on the lower belly (the womb) and let the baby breastfeed — both help the womb contract.</li>
</ol>`},
{ id:"dental", group:"First aid", title:"Dental emergencies",
  summary:"Knocked-out teeth, abscesses and pain when no dentist is available.",
  html:`
<ul>
<li><b>Knocked-out adult tooth</b>: pick it up by the crown (not the root), rinse briefly in milk or saline, and push it back into the socket within 30 minutes if you can; bite on a cloth. Otherwise keep it in milk or the person's saliva and get to a dentist the same day. Never replant baby teeth.</li>
<li><b>Abscess</b> (swelling, throbbing, fever): warm salt-water rinses, painkillers. Swelling spreading to the eye, neck or floor of the mouth, or difficulty swallowing/breathing — emergency.</li>
<li><b>Lost filling</b>: temporary filling kits from pharmacies; keep the area clean.</li>
</ul>
<p><i>Where There Is No Dentist</i> (Hesperian) is in the Library — it covers extractions, abscess care and making temporary fillings.</p>`},
{ id:"outbreak", group:"Hazards", title:"Outbreaks & infection control",
  summary:"Pandemics, gastro outbreaks and caring for the sick at home safely.",
  html:`
<ul>
<li>Handwashing with soap for 20 seconds stops most spread. Alcohol gel (60%+) when there's no water — but it doesn't work on norovirus; soap does.</li>
<li>Care for a sick person in one room, with one carer if possible. Ventilate. Masks for the carer and the patient when close.</li>
<li>Clean high-touch surfaces; for vomit/diarrhoea use 1 part household bleach to 50 parts water (≈1,000 ppm), and wash laundry hot.</li>
<li>Keep fluids going: oral rehydration (1 litre water + 6 level tsp sugar + ½ level tsp salt) in small frequent sips.</li>
<li>Danger signs: breathing difficulty, blue lips, confusion, no urine for 12+ hours, a rash that doesn't fade under a glass, a stiff neck with fever.</li>
</ul>`},
{ id:"grow", group:"Survival", title:"Growing food in Ireland",
  summary:"What grows reliably in an Irish garden, and when to sow it.",
  html:`
<table>
<tr><th>Crop</th><th>Sow / plant</th><th>Harvest</th><th>Notes</th></tr>
<tr><td>Potatoes</td><td>Mar–Apr (earlies), Apr–May (maincrop)</td><td>Jun–Oct</td><td>Calorie king. Watch for blight in warm wet weather (Met Éireann blight warnings).</td></tr>
<tr><td>Kale, cabbage</td><td>Mar–Jun</td><td>All year</td><td>Hardy through Irish winters. Net against pigeons and cabbage white.</td></tr>
<tr><td>Onions, garlic</td><td>Sets Mar–Apr; garlic Oct–Nov</td><td>Jul–Aug</td><td>Store dry for months.</td></tr>
<tr><td>Broad beans, peas</td><td>Feb–Apr (beans also Nov)</td><td>Jun–Aug</td><td>Fix nitrogen; dry for storage.</td></tr>
<tr><td>Carrots, parsnips, beetroot</td><td>Apr–Jun</td><td>Jul–winter</td><td>Parsnips sweeten after frost; leave in ground.</td></tr>
<tr><td>Leeks</td><td>Mar–Apr, transplant Jun</td><td>Oct–Mar</td><td>Stand in the ground all winter.</td></tr>
<tr><td>Salad, spinach, chard</td><td>Mar–Sep</td><td>Most of the year</td><td>Fast; succession sow.</td></tr>
<tr><td>Rhubarb, soft fruit</td><td>Plant in winter</td><td>Apr–Aug</td><td>Perennial, low effort.</td></tr>
</table>
<p>Save seed from open-pollinated varieties. Compost everything. Seaweed is the traditional Irish fertiliser on the west coast.</p>`},
{ id:"knots", group:"Reference", title:"Knots & rope",
  summary:"Six knots that cover almost everything, plus the full knot libraries.",
  html:`
<ul>
<li><b>Bowline</b> — a fixed loop that won't slip; rescue loops, mooring.</li>
<li><b>Clove hitch</b> — quick attach to a pole or rail; start of lashings.</li>
<li><b>Round turn & two half hitches</b> — tie a load-bearing line to a post or ring.</li>
<li><b>Taut-line hitch</b> — adjustable tension for tarps and guy lines.</li>
<li><b>Sheet bend</b> — join two ropes, even of different thickness.</li>
<li><b>Figure-eight (on a bight)</b> — strong loop and stopper knot.</li>
</ul>
<p>The Library includes the <i>Encyclopedia of Knots</i>, US Army rope and lashing manuals, and Wikipedia's illustrated knot articles.</p>`},
{ id:"mind", group:"Reference", title:"Stress, sleep & morale",
  summary:"Looking after your head — and other people's — through a long emergency.",
  html:`
<ul>
<li>Keep routines: fixed wake and meal times, a daily task for everyone, including children.</li>
<li>Limit doom-scrolling and rumour; get updates from official bulletins at set times.</li>
<li>Sleep is a survival tool. Darkness, warmth, and earplugs if sharing space.</li>
<li>Check on people who live alone. Shock, grief and anger are normal after a disaster.</li>
<li>Crisis support: Samaritans 116 123 (24h, both jurisdictions) · Pieta 1800 247 247 · Text HELLO to 50808 · NI Lifeline 0808 808 8000.</li>
</ul>`},
];
for (const g of more) window.GUIDES.push(g);

window.GUIDE_META = {
  numbers:   { icon:"phone", tone:"red" },
  cpr:       { icon:"heart", tone:"red", wiki:["med:Cardiopulmonary_resuscitation","med:Automated_external_defibrillator","med:Cardiac_arrest","med:Recovery_position"], docs:["cardiopulmonary resuscitation","rescue breathing"], lib:"CPR" },
  firstaid:  { icon:"heart", tone:"red", wiki:["med:First_aid","med:Choking","med:Burn","med:Stroke","med:Anaphylaxis","med:Head_injury","med:Bone_fracture","med:Hypothermia"], docs:["choking","burns treatment","splint fracture","recovery position"], lib:"first aid" },
  bleeding:  { icon:"drop", tone:"red", wiki:["med:Bleeding","med:Tourniquet","med:Hypovolemic_shock","med:Wound","med:Sepsis","med:Tetanus","med:Cellulitis"], docs:["tourniquet","wound irrigation","wound closure","pressure dressing hemorrhage"], lib:"wound care" },
  weather:   { icon:"wind", tone:"amber", wiki:["wp:Storm_Éowyn","wp:Tropical_cyclone","wp:Storm_surge","wp:Met_Éireann"], docs:["storm","weather warning","severe weather"], lib:"storm" },
  flood:     { icon:"wave", tone:"amber", wiki:["wp:Flood","wp:Flash_flood","med:Leptospirosis"], docs:["flooding","flood","sandbags"], lib:"flood" },
  power:     { icon:"plug", tone:"amber", wiki:["med:Carbon_monoxide_poisoning","wp:Engine-generator","wp:Power_outage"], docs:["power cut","carbon monoxide","generator"], lib:"power outage" },
  water:     { icon:"drop", tone:"blue", wiki:["wp:Water_purification","med:Giardiasis","med:Cholera","wp:Portable_water_purification","wp:Boil-water_advisory"], docs:["water purification","boil water","bleach drops per litre","filter water"], lib:"water purification" },
  cold:      { icon:"snow", tone:"blue", wiki:["med:Hypothermia","med:Frostbite","med:Trench_foot"], docs:["hypothermia","cold weather survival","frostbite"], lib:"hypothermia" },
  sea:       { icon:"wave", tone:"blue", wiki:["med:Drowning","wp:Rip_current","wp:Cold_shock_response","wp:Irish_Coast_Guard"], docs:["drowning","cold water","sea survival"], lib:"drowning" },
  hills:     { icon:"mountain", tone:"green", wiki:["wp:Mountain_rescue","med:Lyme_disease","wp:Carrauntoohil","wp:Bog"], docs:["mountain rescue","signal for help","whistle"], lib:"mountain" },
  lost:      { icon:"pin", tone:"green", wiki:["wp:Distress_signal","wp:Survival_skills","wp:Ground-to-air_signals"], docs:["lost signal","signaling rescue","ground to air signal"], lib:"survival signal" },
  shelter:   { icon:"tent", tone:"green", wiki:["wp:Debris_hut","wp:Survival_skills","wp:Fire_making","wp:Bivouac_shelter"], docs:["debris hut","improvised shelter","fire starting tinder"], lib:"shelter" },
  navigation:{ icon:"compass", tone:"green", wiki:["wp:Orienteering","wp:Compass","wp:Irish_grid_reference_system","wp:Irish_Transverse_Mercator","wp:Polaris"], docs:["compass bearing","finding direction sun","north star"], lib:"compass navigation" },
  forage:    { icon:"leaf", tone:"green", wiki:["wp:Oenanthe_crocata","wp:Urtica_dioica","wp:Allium_ursinum","wp:Amanita_phalloides","wp:Blackberry","wp:Palmaria_palmata","wp:Conium_maculatum"], docs:["edible wild plants","poisonous plants","mushroom identification","shellfish"], lib:"edible plants" },
  food:      { icon:"can", tone:"green", wiki:["wp:Food_preservation","wp:Home_canning","wp:Food_drying","med:Botulism"], docs:["food storage","canning","drying meat","salt fish"], lib:"food preservation" },
  grow:      { icon:"sprout", tone:"green", wiki:["wp:Potato","wp:Phytophthora_infestans","wp:Kale","wp:Seed_saving","wp:Compost"], docs:["seed saving","compost","potato"], lib:"vegetable garden" },
  medicines: { icon:"pill", tone:"red", wiki:["med:Paracetamol","med:Ibuprofen","med:Oral_rehydration_therapy","med:Paracetamol_poisoning","med:Insulin"], docs:["medical kit","antibiotics","pain relief"], lib:"paracetamol" },
  childbirth:{ icon:"baby", tone:"red", wiki:["med:Childbirth","med:Postpartum_bleeding","med:Neonatal_resuscitation","med:Umbilical_cord"], docs:["delivery baby","bleeding after birth","newborn breathing"], lib:"childbirth" },
  dental:    { icon:"tooth", tone:"red", wiki:["med:Tooth_avulsion","med:Dental_abscess","med:Toothache"], docs:["tooth knocked out","abscess tooth","temporary filling"], lib:"toothache" },
  outbreak:  { icon:"virus", tone:"amber", wiki:["med:Pandemic","med:Norovirus","med:Influenza","med:Hand_washing","med:Oral_rehydration_therapy"], docs:["pandemic influenza","infection control","isolation"], lib:"pandemic" },
  radiation: { icon:"radiation", tone:"amber", wiki:["med:Acute_radiation_syndrome","med:Potassium_iodide","wp:Nuclear_fallout","wp:Fallout_shelter"], docs:["fallout","shelter in place","potassium iodide","radiation sickness"], lib:"fallout" },
  comms:     { icon:"radio", tone:"blue", wiki:["wp:Morse_code","wp:Amateur_radio","wp:RTÉ_Radio_1","wp:Citizens_band_radio"], docs:["radio","morse code","communications"], lib:"radio" },
  sanitation:{ icon:"soap", tone:"blue", wiki:["med:Hand_washing","wp:Latrine","wp:Composting_toilet","med:Diarrhea"], docs:["latrine","sanitation","hand washing"], lib:"latrine" },
  evacuate:  { icon:"car", tone:"amber", wiki:["wp:Emergency_evacuation","wp:Bug-out_bag"], docs:["evacuation","grab bag","72 hour kit"], lib:"evacuation" },
  mind:      { icon:"brain", tone:"blue", wiki:["med:Psychological_first_aid","med:Acute_stress_reaction","med:Post-traumatic_stress_disorder"], docs:["stress","morale"], lib:"psychological first aid" },
  knots:     { icon:"knot", tone:"green", wiki:["wp:Bowline","wp:Clove_hitch","wp:Taut-line_hitch","wp:Sheet_bend","wp:Figure-eight_loop","wp:Round_turn_and_two_half-hitches"], docs:["bowline","clove hitch","lashing"], lib:"bowline" },
  phrases:   { icon:"chat", tone:"green", wiki:["wp:Irish_language","wp:Gaeltacht"] },
  facts:     { icon:"clover", tone:"green", wiki:["wp:Ireland","wp:Northern_Ireland","wp:Eircode","voy:Ireland","voy:Northern_Ireland"] },
};
})();
