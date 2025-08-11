export const traumaScenarios = [
  {
    id: 'avulsed-tooth',
    category: 'knocked-out-tooth',
    severity: 'critical',
    keywords: ['knocked out', 'fell out', 'tooth out', 'avulsed', 'completely out', 'lost tooth'],
    patientQuestions: [
      "My child's front tooth just fell out completely! What should I do?",
      "My tooth got knocked out playing sports",
      "The whole tooth came out with the root",
      "My kid's tooth fell out after falling off the bike"
    ],
    aiResponse: {
      immediate: "Stay calm. This is a dental emergency and time is critical.",
      instructions: [
        "Pick up the tooth by the crown (the white part), never touch the root",
        "If the tooth is dirty, gently rinse it with milk or saline solution - do NOT scrub or use soap",
        "If possible, place the tooth back into the socket and have the patient bite gently on a clean cloth",
        "If you cannot reinsert it, store the tooth in milk, saliva (inside the cheek), or a tooth preservation kit",
        "Come to the clinic IMMEDIATELY - ideally within 30 minutes for the best chance of saving the tooth"
      ],
      urgency: "IMMEDIATE - Every minute counts",
      appointmentType: "emergency",
      followUp: "We'll prepare for your immediate arrival. Call us if you're more than 30 minutes away."
    },
    trainingNotes: [
      "Emphasize the 30-minute golden window",
      "Never recommend water for storage",
      "Differentiate between baby and adult teeth",
      "Stress handling precautions"
    ]
  },
  {
    id: 'chipped-tooth',
    category: 'fractured-tooth',
    severity: 'moderate',
    keywords: ['chipped', 'broken', 'fractured', 'cracked', 'piece broke off'],
    patientQuestions: [
      "I chipped my front tooth while eating. It doesn't hurt much.",
      "A piece of my tooth broke off",
      "My tooth is cracked but still in place",
      "Part of my tooth chipped off"
    ],
    aiResponse: {
      immediate: "I understand you've chipped your tooth. Let me help you determine the urgency.",
      assessment: [
        "Is there severe pain or sensitivity to hot/cold?",
        "Can you see any pink or red tissue in the broken area (this would be the nerve)?",
        "Is there any bleeding?"
      ],
      instructions: [
        "Save any broken pieces in a clean container with milk or saline",
        "Rinse your mouth with warm water",
        "Apply a cold compress to reduce swelling",
        "Avoid chewing on that tooth",
        "Take over-the-counter pain medication if needed"
      ],
      urgency: "TODAY - Should be evaluated within hours",
      appointmentType: "urgent",
      followUp: "We should see you today to check for nerve damage and prevent infection."
    },
    trainingNotes: [
      "Differentiate between urgent vs non-urgent fractures",
      "Ask about pain level and nerve exposure",
      "Advise collection of fragments"
    ]
  },
  {
    id: 'intruded-tooth',
    category: 'tooth-intrusion',
    severity: 'high',
    keywords: ['pushed in', 'shorter', 'intruded', 'pushed up', 'went into gum'],
    patientQuestions: [
      "I fell, and my tooth looks shorter than before.",
      "My tooth got pushed up into my gum",
      "The tooth went back into the gum after impact",
      "My child's tooth disappeared into the gum"
    ],
    aiResponse: {
      immediate: "This sounds like an intruded tooth, which requires immediate attention.",
      instructions: [
        "Do NOT try to pull the tooth back down",
        "Avoid touching or wiggling the tooth",
        "Don't bite down on that side",
        "Apply a cold compress to reduce swelling",
        "Take photos if possible to show progression"
      ],
      urgency: "IMMEDIATE - Same day treatment required",
      appointmentType: "emergency",
      followUp: "We need to see you as soon as possible today to prevent permanent damage."
    },
    trainingNotes: [
      "Intrusion can damage developing teeth in children",
      "Never attempt to reposition at home",
      "Emphasize urgency for permanent teeth"
    ]
  },
  {
    id: 'loose-tooth',
    category: 'luxation',
    severity: 'moderate',
    keywords: ['loose', 'wobbly', 'moving', 'displaced', 'shifted'],
    patientQuestions: [
      "My tooth is wobbly after being hit, but it's still in place.",
      "The tooth moves when I touch it",
      "My tooth feels loose after the accident",
      "The tooth shifted position but didn't fall out"
    ],
    aiResponse: {
      immediate: "A loose tooth after trauma needs careful evaluation.",
      instructions: [
        "Avoid touching or wiggling the tooth",
        "Don't bite or chew with that tooth",
        "Stick to soft foods only",
        "Keep the area clean with gentle salt water rinses",
        "Apply a cold compress to reduce swelling"
      ],
      urgency: "URGENT - Should be seen within 2-4 hours",
      appointmentType: "urgent",
      followUp: "We should stabilize the tooth today to prevent further damage."
    },
    trainingNotes: [
      "Prevent further trauma",
      "Schedule same-day appointment",
      "May need splinting"
    ]
  },
  {
    id: 'delayed-pain',
    category: 'post-trauma-pain',
    severity: 'moderate',
    keywords: ['hurt later', 'pain after', 'started hurting', 'delayed pain', 'now hurts'],
    patientQuestions: [
      "I bumped my tooth last week and now it's starting to hurt.",
      "The tooth was fine after the accident but now it hurts",
      "Pain started days after the injury",
      "My tooth is getting darker after the trauma"
    ],
    aiResponse: {
      immediate: "Delayed pain after dental trauma often indicates nerve damage or infection developing.",
      assessment: [
        "Is the tooth changing color (getting darker)?",
        "Is there swelling in the gum around the tooth?",
        "Do you have throbbing pain or sensitivity to hot?"
      ],
      instructions: [
        "Take over-the-counter pain medication as directed",
        "Avoid extreme temperatures",
        "Keep the area clean",
        "Don't delay treatment as infection can spread"
      ],
      urgency: "TODAY/TOMORROW - Needs evaluation within 24 hours",
      appointmentType: "urgent",
      followUp: "We need to examine and likely take X-rays to check for hidden damage."
    },
    trainingNotes: [
      "Address delayed symptoms",
      "Stress importance of follow-up",
      "May indicate nerve death"
    ]
  },
  {
    id: 'heavy-bleeding',
    category: 'oral-bleeding',
    severity: 'high',
    keywords: ['bleeding lot', 'heavy bleeding', 'won\'t stop bleeding', 'blood everywhere'],
    patientQuestions: [
      "My mouth is bleeding a lot after hitting my face.",
      "The bleeding won't stop",
      "There's blood everywhere from my mouth",
      "Heavy bleeding from the gums"
    ],
    aiResponse: {
      immediate: "Let's control the bleeding first.",
      instructions: [
        "Apply firm, gentle pressure with clean gauze or cloth for 10-15 minutes",
        "Keep your head elevated - don't lie flat",
        "Don't rinse vigorously as it can dislodge clots",
        "If bleeding continues after 15 minutes of pressure, go to the ER",
        "Bite down on gauze/tea bag if the bleeding is from an extraction site"
      ],
      urgency: "IMMEDIATE - ER if uncontrolled, otherwise come immediately",
      appointmentType: "emergency",
      followUp: "If bleeding is controlled, come to the clinic immediately for evaluation."
    },
    trainingNotes: [
      "First-aid steps priority",
      "Clear ER criteria",
      "Differentiate bleeding sources"
    ]
  },
  {
    id: 'baby-tooth-knocked-out',
    category: 'primary-tooth-avulsion',
    severity: 'moderate',
    keywords: ['baby tooth out', 'milk tooth', 'child tooth fell', 'toddler tooth'],
    patientQuestions: [
      "My toddler's tooth came out after a fall.",
      "My child's baby tooth got knocked out",
      "The milk tooth fell out completely",
      "My 4-year-old lost a tooth in an accident"
    ],
    aiResponse: {
      immediate: "I understand a baby tooth has been knocked out. Here's what to do:",
      instructions: [
        "Do NOT attempt to put a baby tooth back in the socket",
        "Apply gentle pressure with gauze to stop any bleeding",
        "Give your child cold water to rinse if able",
        "Offer soft, cold foods (ice cream, yogurt) for comfort",
        "Keep the area clean"
      ],
      urgency: "Within 24 hours - Not immediately urgent but needs checking",
      appointmentType: "urgent",
      followUp: "We should examine within 24 hours to check for damage to other teeth or developing permanent teeth."
    },
    trainingNotes: [
      "NEVER reimplant baby teeth",
      "Can damage permanent tooth buds",
      "Less urgent than adult teeth"
    ]
  },
  {
    id: 'soft-tissue-injury',
    category: 'oral-soft-tissue',
    severity: 'moderate',
    keywords: ['cut lip', 'cut gum', 'tongue cut', 'cheek injury', 'mouth cut'],
    patientQuestions: [
      "My child cut their lip and gum in a fall.",
      "There's a deep cut in the mouth",
      "The lip is split open",
      "Bleeding from a cut inside the cheek"
    ],
    aiResponse: {
      immediate: "Let's address the soft tissue injury:",
      instructions: [
        "Clean the area gently with water",
        "Apply direct pressure to stop bleeding",
        "Use a cold compress on the outside to reduce swelling",
        "For lip injuries, compress from both sides",
        "If cut is deep, gaping, or won't stop bleeding after 10 minutes - go to ER"
      ],
      urgency: "ER for deep cuts, otherwise same-day dental evaluation",
      appointmentType: "urgent",
      followUp: "Even with soft tissue injuries, we need to check for tooth damage."
    },
    trainingNotes: [
      "Combine soft tissue and dental care",
      "Clear ER criteria",
      "Don't forget to check teeth"
    ]
  },
  {
    id: 'jaw-injury',
    category: 'jaw-trauma',
    severity: 'critical',
    keywords: ['jaw pain', 'can\'t close mouth', 'jaw locked', 'face swollen'],
    patientQuestions: [
      "I can't close my mouth properly after being hit",
      "My jaw hurts and feels out of place",
      "Severe pain when trying to bite down",
      "My face is very swollen on one side"
    ],
    aiResponse: {
      immediate: "This could be a jaw fracture or dislocation - this is serious.",
      instructions: [
        "Do NOT try to force your jaw back into place",
        "Immobilize the jaw with a bandage wrapped under the chin and over the head if possible",
        "Apply ice packs to reduce swelling",
        "Go to the emergency room immediately",
        "Take photos of any facial asymmetry"
      ],
      urgency: "EMERGENCY ROOM - Immediately",
      appointmentType: "er_referral",
      followUp: "This requires immediate emergency room evaluation for possible fracture."
    },
    trainingNotes: [
      "Always refer suspected jaw fractures to ER",
      "Don't attempt treatment",
      "May need surgical intervention"
    ]
  },
  {
    id: 'dental-abscess',
    category: 'infection-emergency',
    severity: 'high',
    keywords: ['swollen face', 'pus', 'fever', 'can\'t swallow', 'abscess'],
    patientQuestions: [
      "My face is swollen and I have a fever",
      "There's pus coming from my gum",
      "I can barely swallow and my face is huge",
      "Severe throbbing pain with facial swelling"
    ],
    aiResponse: {
      immediate: "Facial swelling with fever is a serious dental infection.",
      assessment: [
        "Are you having difficulty swallowing or breathing?",
        "Is the swelling spreading to your eye or neck?",
        "Do you have a high fever over 101°F?"
      ],
      instructions: [
        "If difficulty breathing/swallowing - call 911 immediately",
        "Take your temperature and document it",
        "Do not apply heat to the area",
        "Rinse with warm salt water if able",
        "Come immediately or go to ER if severe"
      ],
      urgency: "IMMEDIATE - ER if airway compromise",
      appointmentType: "emergency",
      followUp: "This infection needs immediate treatment to prevent spreading."
    },
    trainingNotes: [
      "Life-threatening if airway involved",
      "Clear ER criteria",
      "May need IV antibiotics"
    ]
  }
];

export const traumaResponseGuidelines = {
  generalPrinciples: [
    "Always assess for life-threatening conditions first",
    "Time is critical for tooth reimplantation (30-minute window)",
    "Never reimplant baby teeth",
    "Document everything for insurance and legal purposes",
    "When in doubt, err on the side of caution"
  ],
  
  triageCategories: {
    immediate: {
      timeframe: "0-30 minutes",
      conditions: ["Avulsed permanent tooth", "Uncontrolled bleeding", "Airway compromise", "Suspected jaw fracture"],
      action: "Direct to clinic immediately or ER"
    },
    urgent: {
      timeframe: "2-4 hours",
      conditions: ["Luxated teeth", "Dental fractures with pain", "Intruded teeth", "Significant soft tissue injuries"],
      action: "Same-day appointment"
    },
    semiUrgent: {
      timeframe: "24 hours",
      conditions: ["Baby tooth avulsion", "Minor chips without pain", "Delayed pain after trauma"],
      action: "Next-day appointment"
    }
  },
  
  transportInstructions: {
    avulsedTooth: ["Milk", "Saliva (in cheek)", "Saline solution", "Tooth preservation kit"],
    fragments: ["Store in milk or saline", "Bring all pieces", "Keep moist"],
    documentation: ["Take photos", "Note time of injury", "Mechanism of injury"]
  },
  
  contraindicatedActions: [
    "Never scrub an avulsed tooth",
    "Never use water to store teeth",
    "Never reimplant baby teeth",
    "Never force a dislocated jaw",
    "Never apply heat to facial swelling"
  ]
};

export const traumaTrainingExamples = {
  conversationFlows: [
    {
      scenario: "Parent calling about knocked-out tooth",
      dialogue: [
        { user: "Help! My son's tooth just got knocked out playing basketball!" },
        { ai: "Stay calm. I need to help you save the tooth. Is it an adult tooth or baby tooth?" },
        { user: "It's his front adult tooth!" },
        { ai: "Time is critical. Find the tooth and pick it up by the white part only, never touch the root. Is the tooth dirty?" },
        { user: "Yes, it fell on the ground" },
        { ai: "Gently rinse it with milk if available, or saline. Don't scrub it. Can you place it back in the socket?" },
        { user: "I'm not sure I can do that" },
        { ai: "That's okay. Place the tooth in milk immediately and come to the clinic RIGHT NOW. We have 30 minutes for the best chance to save it. Are you able to get here quickly?" }
      ]
    },
    {
      scenario: "Adult with dental pain after trauma",
      dialogue: [
        { user: "I hit my tooth last week and now it's really starting to hurt" },
        { ai: "I understand you're experiencing delayed pain after dental trauma. This could indicate nerve damage. Is the tooth changing color or getting darker?" },
        { user: "Actually yes, it looks a bit gray" },
        { ai: "That suggests the nerve may be damaged. We need to see you today or tomorrow at the latest to prevent infection. Are you having throbbing pain or sensitivity to hot?" },
        { user: "Yes, it throbs at night" },
        { ai: "That confirms this needs urgent attention. I can schedule you for an emergency appointment today. We'll likely need X-rays to assess the damage. Can you come in this afternoon?" }
      ]
    }
  ],
  
  keyPhrases: {
    immediate: [
      "We need to see you immediately",
      "Come to the clinic right now",
      "Every minute counts",
      "This is a dental emergency"
    ],
    reassuring: [
      "Stay calm, I'll help you through this",
      "You're doing the right thing by calling",
      "We can handle this",
      "Let's take this step by step"
    ],
    instructional: [
      "Here's exactly what to do",
      "Follow these steps carefully",
      "It's important that you",
      "Make sure to"
    ]
  }
};

export default {
  traumaScenarios,
  traumaResponseGuidelines,
  traumaTrainingExamples
};