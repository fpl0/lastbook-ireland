/* Ireland-specific emergency & self-reliance guides. Written for offline use.
   Numbers and advice checked against public guidance (HSE, Met Éireann, gov.ie, nidirect, Water Safety Ireland)
   as of late 2026 — re-check numbers when you have a connection. */
window.GUIDES = [
{ id:"numbers", icon:"☎️", group:"Emergency", title:"Emergency numbers",
  summary:"112 / 999 and every utility, health and support line for the Republic and Northern Ireland.",
  html:`
<div class="callout red"><b>112 or 999</b> — Garda/Police, Ambulance, Fire, Coast Guard, Mountain &amp; Cave Rescue. Both work everywhere on the island, from any phone, free.</div>
<p>Say which service, then <b>where you are</b> (Eircode, townland, road number, or the ITM / grid reference shown on the Map tab), what happened and how many people are hurt. Stay on the line.</p>
<p><b>Can't speak?</b> Register for emergency SMS before you need it — Republic: text <code>register</code> to <b>112</b>. Northern Ireland/UK: text <code>register</code> to <b>999</b>.</p>
<h3>Republic of Ireland</h3>
<table>
<tr><td>HSE Live (health information)</td><td>1800 700 700</td></tr>
<tr><td>Poisons Information Centre (public line, 8am–10pm)</td><td>01 809 2166</td></tr>
<tr><td>ESB Networks — power cuts, fallen lines</td><td>1800 372 999</td></tr>
<tr><td>Gas Networks Ireland — gas leak (24h)</td><td>1800 20 50 50</td></tr>
<tr><td>Uisce Éireann — water supply</td><td>1800 278 278</td></tr>
<tr><td>Garda Confidential</td><td>1800 666 111</td></tr>
<tr><td>Samaritans (24h)</td><td>116 123</td></tr>
<tr><td>Pieta (suicide &amp; self-harm, 24h)</td><td>1800 247 247 · text HELP to 51444</td></tr>
<tr><td>50808 crisis text line</td><td>text HELLO to 50808</td></tr>
<tr><td>Women's Aid (24h)</td><td>1800 341 900</td></tr>
<tr><td>Childline (24h)</td><td>1800 66 66 66</td></tr>
<tr><td>Out-of-hours GP</td><td>check your GP's recorded message / local co-op (e.g. SouthDoc, Shannondoc, Caredoc, NEDOC, MIDOC, Westdoc, D-DOC)</td></tr>
</table>
<h3>Northern Ireland</h3>
<table>
<tr><td>PSNI non-emergency</td><td>101</td></tr>
<tr><td>NIE Networks — power cuts</td><td>03457 643 643</td></tr>
<tr><td>Gas emergency</td><td>0800 002 001</td></tr>
<tr><td>NI Water — Waterline</td><td>03457 440 088</td></tr>
<tr><td>Samaritans (24h)</td><td>116 123</td></tr>
<tr><td>Lifeline (crisis, 24h)</td><td>0808 808 8000</td></tr>
<tr><td>Domestic &amp; Sexual Abuse Helpline (24h)</td><td>0808 802 1414</td></tr>
<tr><td>NHS-style advice: your GP / GP out-of-hours</td><td>number on your GP's message</td></tr>
</table>
<p class="muted">Write the important ones on paper too — phones die. The Plan tab keeps your own contacts.</p>`},

{ id:"cpr", icon:"❤️", group:"First aid", title:"CPR & defibrillators",
  summary:"Unresponsive and not breathing normally: call 112, push hard and fast, get an AED.",
  html:`
<ol class="steps">
<li><b>Danger</b> — make sure you are safe (traffic, water, electricity).</li>
<li><b>Response</b> — shout and tap their shoulders.</li>
<li><b>Airway &amp; breathing</b> — tilt head, lift chin, look/listen/feel for up to 10 seconds. Gasping is <i>not</i> normal breathing.</li>
<li><b>Call 112 / 999</b> on speaker. Ask for an ambulance and say the person is not breathing. The call-taker will coach you and can tell you where the nearest AED is. Send someone to get it — the Map tab shows ~2,800 mapped defibrillators.</li>
<li><b>Compressions</b> — heel of hand in the centre of the chest, other hand on top, arms straight. Push 5–6 cm deep, <b>100–120 per minute</b> (beat of "Stayin' Alive"). Let the chest fully rise.</li>
<li>If trained and willing: <b>30 compressions : 2 rescue breaths</b>. Otherwise keep doing hands-only CPR non-stop.</li>
<li><b>AED</b> — switch it on and do exactly what it says. Keep compressing while pads go on. Stand clear for the shock, then restart compressions immediately.</li>
<li>Don't stop until help takes over, the person clearly starts breathing normally, or you are exhausted. Swap rescuers every 2 minutes if you can.</li>
</ol>
<div class="callout">Children: same steps, but start with 5 rescue breaths if you can, press one-third of the chest depth (one hand for a child, two fingers for a baby).</div>`},

{ id:"firstaid", icon:"🩹", group:"First aid", title:"First aid essentials",
  summary:"Bleeding, choking, burns, stroke, anaphylaxis, recovery position, head injury.",
  html:`
<h3>Severe bleeding</h3>
<p>Press firmly and directly on the wound with a pad or cloth, and keep pressing for at least 10 minutes. Add more cloth on top — don't lift it to look. For life-threatening limb bleeding that pressure won't stop, a tourniquet 5–7 cm above the wound (not on a joint), tightened until bleeding stops; note the time. Call 112.</p>
<h3>Choking (adult/child over 1)</h3>
<p>If they can cough, encourage coughing. If not: <b>5 sharp back blows</b> between the shoulder blades, then <b>5 abdominal thrusts</b> (fist above navel, pull in and up). Repeat. If they go unresponsive, call 112 and start CPR. Babies: 5 back blows face-down along your forearm, then 5 chest thrusts with two fingers.</p>
<h3>Burns</h3>
<p>Cool under cool running water for <b>20 minutes</b>. Remove jewellery/clothing unless stuck. Cover loosely with cling film or a clean plastic bag. No butter, creams or ice. Seek help for burns larger than the person's hand, on the face, hands, feet, genitals, or any burn on a child.</p>
<h3>Stroke — think F.A.S.T.</h3>
<p><b>F</b>ace drooping · <b>A</b>rm weakness · <b>S</b>peech slurred · <b>T</b>ime to call 112. Note when symptoms started.</p>
<h3>Heart attack</h3>
<p>Crushing chest pain, spreading to arm/jaw, sweating, breathlessness. Call 112, sit them down. If not allergic, they should chew one 300 mg aspirin.</p>
<h3>Anaphylaxis</h3>
<p>Swelling of lips/tongue, wheeze, collapse after a sting/food. Use their adrenaline auto-injector into the outer thigh (through clothing), call 112. Lie them down with legs raised (sit up if breathing is hard). A second injector after 5 minutes if no improvement.</p>
<h3>Recovery position</h3>
<p>Breathing but unresponsive: on their side, top knee bent forward, head tilted back so fluids drain. Keep checking breathing.</p>
<h3>Head injury</h3>
<p>Get help urgently for any loss of consciousness, vomiting, worsening headache, confusion, clear fluid from nose/ears, or a blood-thinner user. Someone should stay with them for 24 hours.</p>
<h3>Fractures &amp; sprains</h3>
<p>Support the limb in the position found; pad and splint to the joint above and below. Sprains: rest, ice wrapped in cloth 20 min, compress, elevate.</p>
<h3>Hypothermia</h3>
<p>Shivering, confusion, slurred speech, drowsiness. Move out of wind and wet, replace wet clothes, insulate including the head and from the ground, share body warmth, give warm sweet drinks if fully alert. Handle gently. No alcohol; don't rub limbs or use very hot baths.</p>`},

{ id:"weather", icon:"🌀", group:"Hazards", title:"Storms & weather warnings",
  summary:"Met Éireann colour warnings, what each means, and how to prepare for named storms.",
  html:`
<table>
<tr><td><span class="pill y">Yellow</span></td><td>Weather that could be a risk for some activities or areas. Be aware.</td></tr>
<tr><td><span class="pill o">Orange</span></td><td>Significant risk to people and property. Be prepared — change plans, secure things, check on neighbours.</td></tr>
<tr><td><span class="pill r">Red</span></td><td>Rare, dangerous weather. <b>Take action</b>: shelter, stay off roads, follow Garda/council instructions. Schools and services usually close.</td></tr>
</table>
<p>Republic: Met Éireann (met.ie, the app, RTÉ Radio 1 bulletins). Northern Ireland: Met Office warnings (yellow/amber/red) on BBC Radio Ulster.</p>
<h3>Before a storm</h3>
<ul>
<li>Charge phones and power banks; fill water containers; check torches and batteries.</li>
<li>Bring in or tie down bins, trampolines, garden furniture. Close storm shutters/curtains on windward side.</li>
<li>Park away from trees. Fill the car fuel tank.</li>
<li>Check on elderly neighbours and anyone on home oxygen or medical equipment — tell ESB if you depend on powered medical equipment (they keep a vulnerable customers list).</li>
</ul>
<h3>During</h3>
<ul>
<li>Stay indoors, away from windows. Do not go to the coast to watch waves — storm surges and overtopping kill.</li>
<li>Avoid driving during Red warnings. Watch for fallen trees, debris and flooding.</li>
<li><b>Fallen power lines: assume they are live.</b> Keep well away (and keep children and animals away) and ring ESB Networks 1800 372 999 / NIE 03457 643 643.</li>
</ul>
<h3>After</h3>
<p>Report damage, photograph it for insurance, use chainsaws only if trained. Many deaths after storms come from clean-up — falls from roofs, tree work, generators and carbon monoxide.</p>`},

{ id:"flood", icon:"🌊", group:"Hazards", title:"Flooding",
  summary:"River, coastal and flash floods: sandbags, moving to height, and never driving through water.",
  html:`
<ul>
<li>Know your risk: OPW flood maps (floodinfo.ie) and your council. River flooding in Ireland often lasts days (Shannon basin, Cork, Athlone, Enniscorthy); coastal flooding peaks with high tide + storm surge.</li>
<li><b>15 cm of fast water can knock you off your feet; 30 cm can float a car.</b> Never walk or drive through floodwater — it hides open manholes, debris and sewage.</li>
<li>Move valuables, documents, medicines and electrics upstairs. Turn off electricity at the fuse board and gas at the meter if water is about to enter — only if it's safe and dry where you stand.</li>
<li>Sandbags (or bags of soil/compost) at doors and air vents; plug sinks/toilets with a weighted bag to reduce backflow.</li>
<li>Keep a go-bag ready (see Kit). Follow Garda/council instructions to leave; local authorities open rest centres — often schools, community halls (Map tab → Shelters/Schools).</li>
<li>After: treat floodwater as contaminated; wear gloves and boots, wash hands, don't let children play in it. Get an electrician to check before switching power back on. Assume private wells are contaminated — boil or test water.</li>
</ul>`},

{ id:"power", icon:"🔌", group:"Hazards", title:"Power, gas & generators",
  summary:"Living through an outage safely, carbon monoxide, generators and gas leaks.",
  html:`
<h3>Power cut</h3>
<ul>
<li>Check powercheck.ie (Republic) / NIE's outage map; report on 1800 372 999 / 03457 643 643.</li>
<li>Switch off appliances (cooker, heaters, irons) but leave one light on so you know when power returns.</li>
<li>Keep fridge and freezer doors closed — a full freezer keeps food frozen about 24–48 hours.</li>
<li>Many homes lose water too (electric pumps on private wells, electric showers), and heating systems with electric pumps stop — even oil and gas.</li>
<li>Use torches, not candles if you can. If you use candles, never leave them unattended.</li>
</ul>
<h3>Carbon monoxide — the silent killer</h3>
<p>Never run a generator, BBQ, patio heater or camping stove indoors, in a garage, or near open windows. Solid fuel (turf, coal, wood) stoves need clean flues and a working CO alarm. Symptoms: headache, dizziness, nausea, tiredness, collapse — get everyone into fresh air and call 112.</p>
<h3>Generators</h3>
<p>Plug appliances directly into the generator. <b>Never back-feed your house wiring</b> — it can electrocute line workers repairing the network. A permanent connection needs a changeover switch fitted by a registered electrician (Safe Electric / NICEIC).</p>
<h3>Gas leak</h3>
<p>Smell of gas: don't touch switches, don't use flames or phones inside, open doors and windows, turn off at the meter, leave, then call Gas Networks Ireland 1800 20 50 50 / NI 0800 002 001 from outside.</p>`},

{ id:"water", icon:"💧", group:"Survival", title:"Safe drinking water",
  summary:"Boil-water notices, private wells, storing and purifying water.",
  html:`
<ul>
<li>Store at least <b>3 litres per person per day</b> for drinking and basic cooking, for at least 3 days, plus extra for pets and washing.</li>
<li><b>Boil water notice</b> (Uisce Éireann / NI Water): bring water to a rolling boil (an automatic kettle is fine), let it cool, store covered. Use boiled or bottled water for drinking, making baby feed, brushing teeth, ice, washing salad. Showering is fine — don't swallow. Babies' formula: use boiled tap water, not bottled water with high sodium.</li>
<li><b>Do-not-consume / do-not-use notices</b>: boiling won't help — use bottled water or council tankers.</li>
<li><b>Private wells</b> (around 1 in 10 homes in the Republic): test at least yearly; after flooding or heavy rain assume contamination with E. coli until tested.</li>
</ul>
<h3>Purifying water from streams, springs or rain</h3>
<ol class="steps">
<li>Choose the clearest source, upstream of farms and septic tanks. Springs are better than rivers; avoid bog-brown water if possible.</li>
<li>Let it settle, then pour through a clean cloth to remove sediment.</li>
<li><b>Boil</b> for 1 minute (rolling boil) — the most reliable method.</li>
<li>No fuel? Plain unscented household bleach (about 5% chlorine, no additives): 2 drops per litre, mix, wait 30 minutes; it should smell faintly of chlorine. Double the dose for cloudy water. Or use purification tablets as directed.</li>
<li>Boiling and chlorine don't remove chemicals or blue-green algae toxins from lakes in summer — avoid scummy water.</li>
</ol>
<p class="muted">Map tab → "Drinking water &amp; springs" shows public taps, wells and springs mapped in OpenStreetMap. Springs and wells are untreated: always purify.</p>`},

{ id:"cold", icon:"❄️", group:"Hazards", title:"Cold snaps, snow & ice",
  summary:"Keeping warm without power, roads, frozen pipes and checking on others.",
  html:`
<ul>
<li>Heat one room and live in it; close internal doors, curtains at dusk, block draughts. Layers, hats and blankets; hot water bottles (not boiling water).</li>
<li>Eat regular hot meals and drinks. Older people and babies lose heat fast — check on neighbours daily.</li>
<li><b>Frozen pipes</b>: know where your stopcock is. Thaw slowly with a hair dryer or warm cloths, never a flame. If a pipe bursts, turn off at the stopcock and drain the system.</li>
<li>Driving: avoid unless essential. Carry blanket, shovel, water, food, charged phone, high-vis, de-icer. Black ice is common on untreated rural roads and in shade.</li>
<li>Clear paths with salt or sand; you can use dishwasher salt or grit.</li>
<li>Animals: break ice on troughs twice a day; provide extra feed and shelter.</li>
</ul>`},

{ id:"sea", icon:"⚓", group:"Outdoors", title:"Sea, lakes & water safety",
  summary:"Cold water shock, Float to Live, rip currents, and calling the Coast Guard.",
  html:`
<div class="callout red">Someone in trouble in water or on cliffs: <b>call 112 / 999 and ask for the Coast Guard</b>. Don't go in after them — throw something that floats.</div>
<h3>If you fall in — Float to Live</h3>
<p>Irish water is cold all year (about 8–15 °C). The first minute brings gasping — fight the urge to swim hard. Lean back, spread arms and legs, keep your airway clear and <b>float until your breathing settles</b>, then call for help or swim to safety.</p>
<ul>
<li>Rip currents: don't swim against them; swim parallel to the shore, then in.</li>
<li>Always wear a lifejacket on boats, kayaks and when fishing from rocks.</li>
<li>Check tide times — strands like Inch, Bundoran and many estuaries cut people off fast.</li>
<li>Jellyfish: Lion's Mane and Portuguese man o' war stings — rinse with seawater (not fresh), remove tentacles with a card, soak in hot water ~45 °C for 20 minutes.</li>
<li>Weever fish stings (sandy beaches): hot water as hot as tolerable for 30+ minutes.</li>
</ul>`},

{ id:"hills", icon:"⛰️", group:"Outdoors", title:"Hills, bogs & mountain rescue",
  summary:"Weather, navigation, grid references and what to do if lost or injured.",
  html:`
<ul>
<li>Irish mountains are small but deadly: fast-changing weather, hill fog, wind on ridges, and wet bog. Carrauntoohil (1,038 m) is the highest.</li>
<li>Bring map (OSi Discovery Series 1:50,000 / OSNI Activity maps), compass, head torch, waterproofs, warm layer, food, water, charged phone, whistle, foil blanket.</li>
<li>Leave a route plan and return time with someone.</li>
<li><b>Lost or injured: call 112 / 999, ask for Mountain Rescue (via Garda/PSNI).</b> Give your <b>grid reference</b> — the Map tab shows ITM and Irish Grid coordinates for your position or any point you tap.</li>
<li>Six whistle blasts (or torch flashes) per minute = distress; three in reply = heard.</li>
<li>Stay together, get out of the wind, sit on your rucksack, add layers. Moving in fog without a bearing often makes things worse.</li>
<li>Bogs: avoid bright green moss (sphagnum) patches — they can be deep. Test with a pole.</li>
<li><b>Ticks</b> (bracken, long grass, deer areas): Lyme disease exists in Ireland. Check skin daily, remove ticks with fine tweezers close to the skin, see a GP for an expanding red rash or flu-like illness.</li>
</ul>`},

{ id:"forage", icon:"🌿", group:"Survival", title:"Wild food in Ireland",
  summary:"Easy, safe-ish wild foods by season — and the deadly lookalikes.",
  html:`
<div class="callout red">Never eat anything you can't identify with certainty. <b>Hemlock water dropwort</b> grows in ditches and riverbanks all over Ireland and is one of Europe's most poisonous plants — avoid all white "umbrella-flowered" plants. Don't eat wild mushrooms unless an expert confirms them; death caps occur here.</div>
<table>
<tr><th>Food</th><th>Season</th><th>Notes</th></tr>
<tr><td>Nettles</td><td>Mar–May</td><td>Young tops, gloves on, cook (soup, like spinach). High in iron.</td></tr>
<tr><td>Wild garlic (ramsons)</td><td>Mar–May</td><td>Woodland, strong garlic smell when crushed. Lookalikes (lords-and-ladies, lily of the valley) don't smell of garlic.</td></tr>
<tr><td>Dandelion</td><td>All year</td><td>Leaves (young ones less bitter), flowers.</td></tr>
<tr><td>Sorrel</td><td>Spring–autumn</td><td>Lemony leaves; small quantities (oxalic acid).</td></tr>
<tr><td>Elderflower / elderberries</td><td>Jun / Sep</td><td>Berries must be cooked; never eat raw stems or leaves.</td></tr>
<tr><td>Blackberries</td><td>Aug–Sep</td><td>Hedgerows everywhere. Easy and safe.</td></tr>
<tr><td>Hazelnuts</td><td>Sep–Oct</td><td>Burren and many hedgerows.</td></tr>
<tr><td>Rosehips, sloes, crab apples</td><td>Sep–Nov</td><td>Cook/jam. Rosehip hairs are irritants — strain well.</td></tr>
<tr><td>Seaweed (dulse, carrageen, sea lettuce)</td><td>Spring–summer</td><td>Cut from clean, living plants on rocks away from outfalls; rinse and dry.</td></tr>
<tr><td>Mussels, periwinkles</td><td>Colder months</td><td>Risky: biotoxins and sewage. Only from clean, classified areas; discard any open shells that don't close; cook thoroughly.</td></tr>
</table>
<p>Fishing: rod licence needed for salmon and sea trout; coarse fishing largely free in the Republic. In a real long-term emergency, potatoes, kale, cabbage, onions and beans grow well in Irish conditions — plant potatoes Mar–Apr.</p>`},

{ id:"food", icon:"🥫", group:"Survival", title:"Food stores & cooking without power",
  summary:"A 7-day pantry, rotation, and safe cooking during outages.",
  html:`
<ul>
<li>Keep at least 3–7 days of food that needs no fridge: tinned fish/meat/beans/veg/fruit, porridge oats, pasta, rice, crackers, peanut butter, UHT milk, soup, nuts, dried fruit, chocolate, tea/coffee.</li>
<li>Remember a manual tin opener, and food for babies, special diets and pets.</li>
<li>Rotate: "first in, first out". Put new tins at the back.</li>
<li>During an outage eat fridge food first, then freezer, then pantry. Discard fridge food that's been above 5 °C for over 4 hours (meat, dairy, cooked rice).</li>
<li>Cook outdoors on camping stoves/BBQ only — never indoors (carbon monoxide). A solid-fuel stove with a hob or a range is gold in an Irish outage.</li>
</ul>`},

{ id:"radiation", icon:"☢️", group:"Hazards", title:"Chemical or radiation emergency",
  summary:"Go in, stay in, tune in.",
  html:`
<ol class="steps">
<li><b>Go in</b> — get indoors quickly; a brick/concrete building is best. If you were outside, remove outer clothing in a bag and wash exposed skin and hair.</li>
<li><b>Stay in</b> — close windows, doors, vents; turn off ventilation and fans. Move to the centre of the building or a basement.</li>
<li><b>Tune in</b> — RTÉ Radio 1, BBC Radio Ulster, local radio, gov.ie / nidirect. Only take iodine tablets if officials instruct you to.</li>
</ol>
<p>Don't collect children from school during the alert — schools will shelter them. Keep pets indoors. Cover food and water.</p>`},

{ id:"comms", icon:"📻", group:"Survival", title:"Radio & communications",
  summary:"Staying informed when phones and internet fail.",
  html:`
<ul>
<li>Keep a battery or wind-up FM radio. Official updates go out on <b>RTÉ Radio 1</b> (FM ~88–90 MHz across the country) and local radio; in Northern Ireland <b>BBC Radio Ulster</b> (FM ~92–95.4 MHz).</li>
<li>Text messages often get through when calls don't. Keep messages short; set up a family group text.</li>
<li>Agree an out-of-area contact all family members check in with.</li>
<li>Save battery: low-power mode, lower brightness, close apps, turn off Wi-Fi/Bluetooth when not needed. A car can charge phones (with the engine running, outdoors).</li>
<li>Signals: 3 of anything (whistles, fires, flashes) = help; SOS in Morse is ··· ––– ···.</li>
</ul>`},

{ id:"sanitation", icon:"🧼", group:"Survival", title:"Hygiene & sanitation",
  summary:"When toilets don't flush and water is scarce.",
  html:`
<ul>
<li>Toilets can be flushed by pouring a bucket of any water (rain, river) into the bowl.</li>
<li>No water: line the toilet or a bucket with two bin bags, add a little sawdust, soil, cat litter or ash after each use, tie off, store away from living spaces.</li>
<li>Hand hygiene prevents most outbreak illness: soap and a little water, or alcohol gel. Always before food and after toilet.</li>
<li>Vomiting/diarrhoea: oral rehydration — 1 litre clean water + 6 level teaspoons sugar + ½ level teaspoon salt.</li>
</ul>`},

{ id:"evacuate", icon:"🚗", group:"Emergency", title:"Leaving home quickly",
  summary:"What to grab, where to go, how to find each other.",
  html:`
<ol class="steps">
<li>Grab your go-bag (Kit tab), medicines, phone + charger, wallet, keys, documents, glasses, pets.</li>
<li>Turn off gas, electricity and water if told to and safe.</li>
<li>Lock up. Tell a neighbour or your out-of-area contact where you're going.</li>
<li>Use the routes officials give. Don't drive through floodwater or around barriers.</li>
<li>Go to your agreed meeting place (Plan tab) or the rest centre announced on radio. Use the Map tab offline to find community halls, schools and shelters near you.</li>
</ol>`},

{ id:"phrases", icon:"☘️", group:"Reference", title:"Irish (Gaeilge) emergency phrases",
  summary:"Useful in the Gaeltacht and to read signs.",
  html:`
<table>
<tr><td>Help!</td><td><b>Cabhair!</b> (KOW-er)</td></tr>
<tr><td>Danger</td><td><b>Contúirt</b> / <b>Baol</b></td></tr>
<tr><td>Fire</td><td><b>Dóiteán</b></td></tr>
<tr><td>Police</td><td><b>Gardaí</b> (GAR-dee)</td></tr>
<tr><td>Ambulance</td><td><b>Otharcharr</b></td></tr>
<tr><td>Hospital</td><td><b>Ospidéal</b></td></tr>
<tr><td>Doctor</td><td><b>Dochtúir</b></td></tr>
<tr><td>Water</td><td><b>Uisce</b> (ISH-ka)</td></tr>
<tr><td>I am hurt</td><td><b>Tá mé gortaithe</b></td></tr>
<tr><td>Where is…?</td><td><b>Cá bhfuil…?</b> (kaw will)</td></tr>
<tr><td>Do you speak English?</td><td><b>An bhfuil Béarla agat?</b></td></tr>
<tr><td>Thank you</td><td><b>Go raibh maith agat</b></td></tr>
<tr><td>Yes / No</td><td><b>Tá / Níl</b> (Irish has no single word for either)</td></tr>
</table>
<h3>Common sign words</h3>
<p><b>Géill slí</b> yield · <b>Stad</b> stop · <b>Mall</b> slow · <b>Lána bus</b> bus lane · <b>An Lár</b> city centre · <b>Fir / Mná</b> men / women (Mná = Women!) · <b>Sráid</b> street · <b>Bóthar</b> road · <b>Trá</b> beach · <b>Cnoc</b> hill · <b>Loch</b> lake · <b>Baile</b> town.</p>`},

{ id:"facts", icon:"🧭", group:"Reference", title:"Ireland at a glance",
  summary:"Grid systems, Eircodes, borders, daylight, wildlife and other practical facts.",
  html:`
<ul>
<li><b>Two jurisdictions</b>: the Republic (euro, Garda Síochána, HSE, Met Éireann) and Northern Ireland (sterling, PSNI, HSCNI, Met Office). The border is open; 112/999 work on both sides and mobile phones may roam to a network across the border.</li>
<li><b>Eircode</b>: every Republic address has a 7-character code (e.g. A65 F4E2) — the fastest way to tell emergency services where you are. NI uses UK postcodes (BT…).</li>
<li><b>Grid references</b>: maps use ITM (Irish Transverse Mercator, e.g. 715830, 734697) and the older Irish Grid (letter + digits, e.g. O 15 34). The Map/Tools tabs convert your position.</li>
<li><b>Daylight</b>: about 7.5 hours in late December, ~17 hours in late June. Sunset can be before 4:15pm in December — plan walks accordingly (see Tools for sunrise/sunset).</li>
<li><b>Wildlife</b>: no snakes and no rabies on the island. Real hazards are ticks, dogs, cattle (especially cows with calves and bulls), jellyfish and the weather.</li>
<li><b>Driving</b> on the left; speed limits km/h in the Republic, mph in NI.</li>
<li><b>Rest centres</b> in major emergencies are opened by local authorities, usually in schools, community centres and sports halls.</li>
</ul>`},
];

window.KIT = [
 ["Water", ["Drinking water: 3 L per person per day for 3+ days","Water purification tablets or plain bleach","Spare containers / jerrycan"]],
 ["Food", ["3–7 days of non-perishable food","Manual tin opener","Camping stove + fuel (outdoor use)","Baby food / formula if needed","Pet food"]],
 ["Light & power", ["Torch / head torch + spare batteries","Battery or wind-up FM radio","Power bank (charged) + cables","Car phone charger","Matches / lighter in a sealed bag"]],
 ["Health", ["First aid kit","7 days of prescription medicines","Copies of prescriptions","Painkillers, rehydration salts","Hand sanitiser, soap, toilet roll, bin bags","Glasses / hearing aid batteries"]],
 ["Warmth & shelter", ["Warm clothes, hats, gloves, waterproofs","Blankets / sleeping bags","Foil emergency blankets","Sturdy boots"]],
 ["Documents & money", ["Cash in small notes (euro / sterling)","Copies of ID, insurance, PPS/NI numbers","Paper list of phone numbers","Spare house and car keys"]],
 ["Tools", ["Multitool / knife","Whistle","Duct tape","Work gloves","Bucket","Plastic sheeting","Fire extinguisher / fire blanket","Working smoke and CO alarms (test monthly)"]],
 ["Car kit", ["Fuel at least half full in winter","Blanket, water, snacks","Shovel, de-icer, scraper","Hi-vis vest, warning triangle","Jump leads, tow rope"]],
];
