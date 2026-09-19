# Product vision

## Purpose

ScrapTrace aims to give an e-waste collection a trustworthy digital beginning and connect it to safe guidance, a suitable handover location, recycler confirmation, and evidence of processing. It is intended to make safer collection easier for people to act on and easier for authorised programmes to verify.

The [approved SRS v1.1](<ScrapTrace_Software_Requirements_Specification (2).docx>) is authoritative for application requirements and acceptance. The [Concept Note](../../concept_note.md) remains authoritative for the original problem context and intent. Requirements are not claims of current implementation.

## People served

ScrapTrace serves collectors and household users, recycler operators, programme reviewers and managers, safety/content administrators, and data/ML reviewers. Policy and producer-responsibility organisations may later consume authorised reports, subject to governance and integration decisions.

## Problem addressed

Collection, handover, weighing, and processing are often not connected by one record. People may not know where to take an item or how to avoid unsafe handling. Programmes may see a final weight without enough evidence about origin, movement, duplicates, or processing. Economic pressure can also favour rapid, unsafe extraction when safe delivery has no clear benefit.

## Value

- **Collectors:** early identification, reviewed safety guidance, an indicative price range, participating-location discovery, and evidence of accepted deliveries.
- **Households:** understandable guidance and a path to repair, reuse, collection, or recycling without hazardous dismantling.
- **Scrapyards and recyclers:** clearer incoming-delivery information, measured-weight records, and a processing-evidence trail.
- **Programme managers:** linked collection and receipt evidence, exception review, aggregate results, and signals about gaps in collection access.

## Connected value chain

Image-assisted categorisation selects relevant approved safety information. That guidance leads the user toward a participating location rather than unsafe extraction. An indicative price supports planning without promising value. Item or batch records connect capture to QR-assisted handover, measured weight, processing evidence, and human review where required. Only after these checks could an authorised programme use completed records for reporting or a separately approved incentive.

## More than image classification

The vision model is an enabling component, not the product. ScrapTrace's main value is the coordinated journey across safety, access, collection evidence, independent handover confirmation, exception review, and programme reporting. A correct category prediction alone does not demonstrate recycling.

## Claims ScrapTrace does not make

ScrapTrace does not guarantee that a prediction is correct, determine exact material value from a photograph, guarantee collector income, teach hazardous home dismantling, certify every listed location, prove recycling from one image or QR code, issue official EPR credits, or independently authorise payments. Recycler approval, official reporting, incentives, mobile money, and government use require evidence, governance, and authorisation outside the hackathon scope.
