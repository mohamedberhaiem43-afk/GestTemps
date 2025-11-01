export interface Presence {
    empcod?: string; // Employee code
    predat?: Date; // Date
    ordre?: number; // Order
    empmat?: string; // Employee matriculation
    sercod?: string; // Service code
    codposte?: string; // Post code
    preentmat?: string; // Morning entry time
    presortmat?: string; // Morning exit time
    preentamidi?: string; // Afternoon entry time
    presortamidi?: string; // Afternoon exit time
    preentmatup?: string; // Updated morning entry time
    presortmatup?: string; // Updated morning exit time
    preentamidiup?: string; // Updated afternoon entry time
    presortamidiup?: string; // Updated afternoon exit time
    preentsup?: string; // Sup1 entry time
    presortsup?: string; // Sup1 exit time
    preentasup?: string; // Sup2 entry time
    presortasup?: string; // Sup2 exit time
    preentsupup?: string; // Updated Sup1 entry time
    presortsupup?: string; // Updated Sup1 exit time
    preentasupup?: string; // Updated Sup2 entry time
    presortasupup?: string; // Updated Sup2 exit time
    presem?: number; // Presence week
    prerepos?: string; // Rest day flag
    prerepas?: number; // Meal time
    preretmate?: Date; // Return time morning entry
    preretmats?: Date; // Return time morning exit
    preretame?: Date; // Return time afternoon entry
    preretams?: Date; // Return time afternoon exit
    preretmateup?: Date; // Updated return morning entry
    preretmatsup?: Date; // Updated return morning exit
    preretameup?: Date; // Updated return afternoon entry
    preretamsup?: Date; // Updated return afternoon exit
    preavantent?: number; // Pre-advance entry
    preapresent?: number; // Post-presentation entry
    preavantsort?: number; // Pre-advance exit
    preapressort?: number; // Post-presentation exit
    soccod?: string; // Company code
    sitcod?: string; // Situation code
    empreg?: string; // Employee register flag
    empcharge?: string; // Employee charge flag
    preobs?: string; // Observations
    dmdate?: Date; // Data modification date
    catcod?: string; // Category code
    tothre?: string; // Total hours
    tothabs?: string; // Total absence
    tothsup?: string; // Total overtime
    tothnuit?: string; // Total night hours
    optimise?: string; // Optimized flag
    totcmp?: number; // Total complement
  }
  