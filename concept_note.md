ScrapTrace
Concept Note
An offline AI-powered platform for identifying, safely collecting and verifying e-waste recycling.
Table of Content
Summary	2
The problem	2
The solution	3
How ScrapTrace works	3
A simple example	4
Who will use it	5
What the prototype will demonstrate	5
How the safety and learning guide works	5
How the system improves the image database	6
How the price estimate works	6
How nearby locations are found	7
How records can be trusted	7
Privacy and safe use	7
Expected value	7
For collectors	7
For recyclers	8
For policy makers	8
For the open data community	8
Future development	8
How the service could continue after the hackathon	8
What success will look like	9
Conclusion	9
References	9










Summary
A waste collector finds an old refrigerator. Today, the collector may sell it without any record showing where it was found, when it was collected, who collected it, its condition, its weight, who received it or whether it was recycled safely. This information could help a recycler prepare for the delivery, help a collection programme measure its work and help the collector prove that the refrigerator reached a safe recycler. When nobody records the information, these benefits are lost.
ScrapTrace changes this journey. The collector takes a picture with a phone. The application identifies the type of electronic waste, explains the main safety risks and shows what the person can do without opening or burning the item. It also creates a digital record. The record follows the refrigerator when it is delivered to a recycler. The recycler confirms that it was received, records its weight and adds proof of safe processing. In this way, ScrapTrace makes safe collection easier to do, more worthwhile for the collector and easier for a programme to verify.
The completed record shows the type and number of items collected, their collection location and date, the collector, the receiving recycler, the measured weight and the final processing result. Government collection schemes, producer take-back schemes and recycler collection networks could use these records. For example, they could see which communities produce many old refrigerators, place collection points closer to those communities, plan enough transport and recycling space, and compare the amount collected with the amount that actually reached a recycler.
Ghana's law allows the national e-waste fund to support collection and safe recycling. If the responsible authority creates an incentive programme, it could set a bonus for each verified item or kilogram delivered to an approved recycler. ScrapTrace would link the completed record to the collector who created it, calculate the bonus using the approved rate and send the payment instruction to mobile money. This would be an extra reward for safe delivery. It would not replace the normal price the collector receives for the scrap.
The problem
Electronic waste includes discarded refrigerators, televisions, computers, air conditioners and other electrical items. The world generated 62 million tonnes of electronic waste in 2022. Only 22.3 percent was formally recorded as collected and recycled. Much of the remaining waste was stored, dumped, traded without records or handled outside formal recycling systems.
In Ghana, many people earn income by collecting, buying, repairing and dismantling old electronics. Their work brings valuable materials back into use. However, much of this activity is not recorded. A recycler, company or government agency may know the final weight of material received, but may not know who collected it, where it came from or how it moved through the chain.
This missing information creates practical problems. A collector may deliver waste but have no record that connects the work to a future incentive. A recycling programme may not know which town needs a collection point or whether it needs a truck for refrigerators, televisions or small computer parts. A producer may receive a report saying that 500 kilograms was recycled but have no clear trail from collection to delivery. The same photograph or load might also be reported twice. Without linked records from the collector and recycler, these errors and false claims are harder to find.
There are also too few easy-to-find formal collection points and advanced recycling facilities in many parts of sub-Saharan Africa. A person may have an old television or refrigerator but may not know where to take it. A collector may know only the nearest informal buyer. This makes it harder for waste to reach places that can handle it safely. It also leaves government and recycling programmes without clear evidence of the towns where new collection points, transport services or recycling capacity are most needed.
There is also an economic reason why unsafe recycling continues. Burning or breaking an item can give a collector quick access to valuable metal, while safe recycling may cost more because it needs proper transport, equipment and careful handling of dangerous parts. If safe delivery does not bring a clear benefit, people may continue using the faster but harmful option. ScrapTrace is designed to help close this gap by linking verified safe delivery to a possible extra payment from an approved programme.
Unsafe handling creates serious health risks. Burning cables and plastic parts can release poisonous smoke. Breaking, heating or cutting electronic items can expose people to harmful substances such as lead, mercury and cadmium. The smoke and dust can harm the lungs, brain and nervous system, especially when children, pregnant women and nearby families are exposed. Many people do not receive simple advice about the danger inside a device or the safest next step after finding it.
Ghana's Hazardous and Electronic Waste Control and Management Act, 2016 (Act 917) provides a legal framework for controlling electronic waste. However, a law alone cannot tell a person what to do with the old device in front of them or show them the closest suitable place. People need clear safety information, easy directions and a collection record that connects the item to safe handling.
The solution
ScrapTrace is a web application designed to work well on a phone, even when the internet is weak or unavailable. It is a digital incentive and evidence system for safe e-waste tracking and collection. It helps a collector or member of the public identify e-waste and understand its main safety risks. It shows simple safety precautions and actions the person can take, an estimated price range and nearby participating scrapyards, collection centres or approved recyclers. It also creates a record at the place where the waste is found. A recycler can later confirm that the same waste was received, weighed and processed.
ScrapTrace will support more than one language, so that collectors and members of the public can receive information in a language they understand. The user can select a preferred language when opening the application and change it at any time. Important instructions, safety warnings, location details and record statuses will be presented in the selected language. The first prototype will support English, French, Arabic and Portuguese, while later versions can add more languages based on the communities using the platform.
The application uses artificial intelligence, also called AI. This is a computer program that learns from data. It uses the challenge's database of 5,000 real images from Ghanaian scrapyards. The images cover seven groups: refrigerators, laptops and desktop computers, televisions, microwaves, air conditioners, compressors and mixed scrap. They teach the application how these items look in real scrapyard conditions.
AI is an enabling tool in this design, not the whole solution. Its job is to make the service easier to use by recognising the item, selecting the right safety guide and supporting an early price estimate. The main value of ScrapTrace is the link between a collector's action, a safe handover, verified recycling and reliable programme records.
This approach builds on a GIZ pilot in Accra. The pilot paid collectors an extra amount for delivering unburned cables to a proper recycling facility and recorded the people, cable types, weights, payments and photographs for each delivery. It collected 27.5 tonnes through 1,389 recorded transactions and showed that safe collection can become more attractive when collectors are paid for the environmental service they provide. ScrapTrace brings this proven collection idea into a phone-based system that can be used across more places and for more types of e-waste.
How ScrapTrace works
The collector takes a picture. The picture must be taken inside the application. This reduces the chance of using an old picture from the phone.
The application suggests a category. The AI checks the picture, suggests the type of e-waste and shows how sure it is. The collector can correct a wrong answer. The correction is saved for checking; it does not change the AI immediately.
The application shows a multilingual safety and learning guide. After the item is identified, the application opens a short guide for that device type. It explains what the device is, what may be dangerous if it is broken or burned, what the person should avoid and the safest next step. The guide suggests repair or reuse by a trained technician when this is safe. It will not teach people to dismantle hazardous devices at home. This helps reduce improper handling or recycling of e-waste and posing serious health risks..
The application gives a price range. It combines the item category, number of items, condition selected by the collector and a local reference price list. The result is an estimate, not a final offer. The recycler confirms the final value after checking and weighing the waste.
The collector finds a nearby place to sell or deliver it. The application compares the phone's location with a directory of participating scrapyards, collection centres and recyclers. It lists the nearest options, the waste they accept, their opening hours, contact details and directions.
The application creates a recovery record. The record contains the picture, category, date, approximate location, collector account, estimated value and chosen delivery location. A large item can receive its own QR code. Small parts and mixed scrap can be grouped into one batch.
The record waits safely when there is no internet. The phone stores the information. It can also show a recently saved list of nearby locations. The record is sent to the main system when a connection becomes available.
The recycler confirms the handoff. When the waste arrives at the recycler's yard or facility, the recycler scans the QR code, checks the item or batch and records the measured weight and final buying price. The confirmation photo should show the full delivery on the scale and the scale reading clearly, so the record can be checked later.
The recycler records what happened next. The recycler adds the processing result and supporting evidence. A complete record passes the required checks. A record is sent for human review when information is missing or does not match, such as a repeated picture, a different item category or an unusual weight.
The dashboard shows the full journey. Approved users can see what was collected, where it was collected, which location received it, its verified weight, final value and processing status.
A simple example
Consider a collector named Kofi. This is an example used to explain the process. Kofi finds two old televisions and several loose electronic parts. He opens ScrapTrace on his phone and takes pictures. The application identifies the televisions and asks about their condition. It warns Kofi not to break the screens or burn the wires because this can release harmful dust and smoke. It tells him to keep the items dry, avoid opening them and take them to a suitable collection or recycling point. It asks Kofi to register the loose parts as one mixed-scrap batch. It then shows an estimated price range and three nearby participating locations that accept these items.
Kofi has no internet at the collection point, so the application saves the records on his phone. Later, the records are sent when his phone connects to the internet. The application gives each television a QR code and gives the mixed scrap one batch code.
Kofi chooses one location. At the recycling facility, a worker scans the codes, checks the items and weighs them. The confirmed weight and the facility's current buying rate determine the final price. After safe processing, the facility adds the result and completes the records. The dashboard can now show the journey from Kofi's first pictures to the recycler's final report. If an approved incentive pays a bonus for verified safe delivery, the system uses Kofi's completed record and the programme's rate to calculate the bonus for his mobile money account. This can give him more income and gives him a clear reason to choose safe and proper recycling instead of burning or breaking the items.
Who will use it
User
How ScrapTrace helps
Collectors and households
Identify e-waste, learn the main risks, follow safe handling advice, see an estimated price and find a nearby suitable place.
Scrapyards and recyclers
Show accepted items and prices, receive planned deliveries, confirm weight and keep evidence of processing.
Government and programme managers
Find areas that need collection points, compare recorded collection with recycler receipts and review records that do not match.
Producers and responsibility organisations
Use approved records to check how much waste reached safe recycling and support take-back or incentive reporting under Ghana's rules.
Researchers and data managers
Study collection patterns and review corrected images that may improve the open dataset.

What the prototype will demonstrate
The hackathon prototype will focus on one complete and understandable journey. It will show that the supplied image database can support a practical waste-tracking service.
A phone-friendly collector page that can capture and save a record without internet access
AI identification for the seven categories in the challenge database
A clear confidence score, user correction and a review list for future model improvement
A safety and learning guide for each of the seven device groups, with clear warnings and safe next steps
An indicative price range based on category, condition and a sample local price list
A map and list of nearby participating scrapyards, collection centres and recyclers
Item and batch records with QR codes
A recycler page for confirming receipt, showing the delivery on a scale and entering measured weight
A journey page showing each step from collection to processing
Checks for possible duplicate pictures and missing information
A dashboard showing categories, locations, verified weight and record status
A clearly labelled example showing how an approved future collector bonus could be calculated from verified weight
How the safety and learning guide works
The picture helps ScrapTrace choose the correct guide. The guide will be based on approved health and recycling information. It will not be freely invented by the LLM each time. The guide itself will come from short safety cards prepared from trusted health and recycling information and checked by people who understand e-waste safety. This keeps the advice consistent and reduces the risk of the application giving unsafe instructions.
Each safety card will answer five simple questions: 
What is this item? 
What may be dangerous inside it? 
What should I not do? 
What can I safely do now? 
Where can I take it? 
The card can use short text, clear pictures and audio in future versions so that people with different reading levels can understand it. A saved copy will remain available when the phone has no internet. The application will use a Large Language Model (LLM) to rewrite the approved guide in simple language, translate it or read it aloud. 
The image model identifies the item type, ScrapTrace retrieves the matching approved safety information, and the LLM explains only that information. If no approved information is available, the LLM must not guess; it should tell the person to contact an approved recycler or trained technician. We are putting this restriction because LLMs can hallucinate and give wrong information, we can’t trade with that shortcoming, that’s why we are using pre-populated safety information which the LLM will rely on.
Each guide will be checked by people who understand e-waste safety. The guide will record its source, approval date and review date. This keeps the advice consistent while still allowing the LLM to make it easier for different people to understand.
For example, a refrigerator guide can warn the user not to cut its cooling pipes or remove the compressor at home. A television guide can warn the user not to smash the screen. A laptop guide can warn the user not to press, puncture or charge a swollen battery. If an item is hot, smoking or leaking, the guide will tell the person to move away, keep other people away and contact an approved handler or local emergency service.
Personal recycling in ScrapTrace means safe actions that an ordinary person can take: protect the item from rain, keep children away, use a trained repairer when reuse is possible, and deliver the item without breaking it. It does not mean extracting metals or handling dangerous parts at home. The nearby-location feature then turns the advice into action by showing a suitable place that accepts the item.
How the system improves the image database
The application does more than use the existing images. It can also help improve the database over time. When the AI gives a wrong answer, the collector can correct it. The correction goes into a review list. A recycler or trained data reviewer compares the label with the picture and the delivered item. Only approved corrections can become new training examples, and only when the people and organisations responsible for the data allow this use.
The team can add the approved examples to the training data and train a new version of the model at set times. The new model is tested before it replaces the old one. This is safer than allowing the AI to learn immediately from every correction, because an accidental or false correction could teach it the wrong answer. This process is supervised learning with people checking the data.
How the price estimate works
A photograph can help identify an item and count visible items, but it cannot show the exact weight, hidden materials or working condition. ScrapTrace will therefore present a price range rather than promise an exact price.
For a television or refrigerator, the application will use the AI category, the number of items, the condition chosen by the collector and a local price range based on information supplied by participating buyers or a market study. If the collector already knows the weight, it can be entered to improve the estimate. For mixed scrap, the collector must enter an approximate weight because a picture alone cannot measure it reliably. Participating buyers may publish their current rates, with the date of the latest update clearly shown.
The recycler checks the condition and uses a scale at delivery. The final price is then based on the confirmed item, measured weight and the buyer's current rate. Any extra safe-delivery incentive would be shown separately from the normal scrap price and would only be calculated after the record passes the required checks. This makes a basic estimate realistic for the hackathon while keeping the final transaction honest.
How nearby locations are found
Each participating scrapyard, collection centre or recycler creates a profile with its map location, contact details, opening hours and the types of waste it accepts. With the collector's permission, ScrapTrace reads the phone's location and calculates which listed places are closest. The collector can view them on a map or as a simple list, call a location and open directions.
The application will clearly show whether a location is a scrapyard, collection centre or approved recycler. It will not describe every nearby business as a safe recycler. Programme managers must check profiles before marking a location as verified. A saved directory can remain available when the phone is offline, although opening live directions may require internet access.
ScrapTrace does not build recycling plants. It addresses the access problem by bringing existing scrapyards, collection centres and approved recyclers into one checked directory and making them easier to find. The records also show where the network is still weak. Programme managers can use this evidence when deciding where to add a collection point, arrange a pickup service or support a new recycling facility.
How records can be trusted
No single picture, QR code or location can prove that recycling happened. ScrapTrace therefore combines evidence from different steps. The collector creates the first record. The recycler confirms the handoff separately. The measured weight and processing evidence complete the record.
The application will also keep a history of changes and check for repeated pictures or unusual records. A unique number will identify each item or batch. The system will create a special code for each record. If someone changes the record later, the code will change and the system can show that an edit was made.
A record goes to the review list when the AI is very unsure, the collector and recycler choose different categories, the same picture appears in another record, the recorded weight falls far outside the normal range or required proof is missing. An authorised programme reviewer checks the picture, handoff details and recycler evidence. The reviewer can approve the record, ask for more information or reject it. Only an approved, complete record can be used in official reports or a bonus calculation.
Privacy and safe use
ScrapTrace will collect only the information needed for tracking. A collector's personal details will not appear on the public dashboard. Different users will see only the information required for their work. The system will record important actions so that authorised reviewers can see who created, confirmed or changed a record.
The application will explain what information is collected and why. People must agree before their images or corrections are considered for future training data.
Expected value
For collectors
Collectors can identify items, understand their main risks, follow safe handling advice, compare nearby delivery options and receive an early price range before travelling. They also keep proof of the items and batches accepted by a recycler. If an approved programme pays a safe-delivery bonus, the completed record shows which collector should receive it and it’s sent to the mobile money account.
Collectors and households can receive safety guidance in a language they understand. This makes it easier to recognise dangerous actions, follow safe handling instructions and find an appropriate place to take the item. Audio and simple pictures can also help users with lower reading ability, in subsequent versions
For recyclers
Recyclers receive better information before and during delivery. They can organize incoming waste, record measured weights and keep a clear history of processing.
For policy makers
Policy makers can see which types of e-waste are collected in each area and how much reaches participating recyclers. They can use this to choose locations for collection centres, estimate transport and recycling needs, compare targets with completed deliveries and investigate large gaps between collection claims and recycler receipts. The system can also count searches without showing the names of the people who searched. For example, if many people in one district search for a refrigerator collection point but the nearest verified place is far away, this shows that the district may need a collection point or pickup service.
For the open data community
The challenge database becomes easier to understand and more useful in a real application. Reviewed field corrections may also help future researchers build better models for Ghanaian scrapyard conditions.
Future development
The first version will prove the collection, safe handoff and evidence process. Later versions may connect to mobile money, approved recycling programmes, Producer Responsibility Organisations and government reporting systems.
Extended Producer Responsibility means that producers help pay for the safe collection and recycling of products after people finish using them. ScrapTrace will not create or issue an official EPR credit by itself. A regulator or authorised organisation would need to approve the rules, verify the evidence and decide how payments or certificates are issued.
An EPR credit marketplace would therefore be a later service built on top of the verified records. The first responsibility of ScrapTrace is to make the collection and recycling evidence reliable. Once an authorised organisation accepts the records, producers could use them to support approved reporting or purchase verified environmental results.
Future partnerships could allow a collector to receive an extra safe-delivery bonus. For example, an approved programme could set a rate for each verified kilogram of a selected waste type. After the recycler confirms the weight and the record passes review, ScrapTrace could calculate the bonus and send an instruction to a mobile money service. The authority responsible for the programme would set the rate, provide the funds and approve the payment rules with recyclers and worker representatives.
How the service could continue after the hackathon
The collector application should remain free to use. Organisations that manage recycling programmes could pay for services such as reporting, programme dashboards, verification tools and system connections. Any payment model should be tested with collectors and recyclers to ensure that it does not reduce the collector's normal scrap income.
What success will look like
The application will be successful if a user can follow one item or batch from the first picture to the recycler's confirmation without needing a technical explanation. The demonstration should also show that the system works with weak connectivity, reports uncertainty when the AI is unsure and does not present unverified claims as facts.
A later field test would measure AI accuracy, time needed to create a record, number of completed handoffs, duplicate records detected, verified weight delivered and collector satisfaction. Income or environmental improvements would be reported only after real testing provides evidence.
Conclusion
Informal collectors already perform the first and most important step in e-waste recovery: they find and collect discarded equipment. Their work is often missing from formal records. ScrapTrace gives each collection a simple digital beginning and follows it to a recycler. It is designed to make safe delivery financially worthwhile and to give every approved programme evidence it can trust.
The project uses real images from Ghanaian scrapyards to solve a clear problem. It helps people understand the waste and handle it more safely. It helps collectors take part in formal programmes, helps recyclers keep better records and gives decision makers clearer information about where collection services are missing. The hackathon prototype will show that AI can support a complete incentive and evidence journey: from the first picture, to safe handover, to verified recycling. The same foundation can later support approved payments, EPR reporting and wider collection programmes.
ScrapTrace does not only identify e-waste. It explains the risks and safest next step in a language the user understands, then connects that person to a suitable collection or recycling location
References
1. UNITAR and ITU, The Global E-waste Monitor 2024. Read source
2. Republic of Ghana, Hazardous and Electronic Waste Control and Management Act, 2016 (Act 917). Read source
3. GIZ Hackathon E-Waste Image Database Concept Note, 2026. Challenge document supplied to participants
4. GIZ, Incentive Based Collection of E-Waste in Ghana, 2020. Read source
5. African Centre for Economic Transformation, Turning Africa's E-Waste Crisis into a Circular Economy Opportunity. Read source
6. African Centre, The Growing E-Waste Crisis A Call for Action and Opportunity in Africa. Read source
7. World Health Organization, Soaring E-Waste Affects the Health of Millions of Children. Read source
