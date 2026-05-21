"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeTag = normalizeTag;
exports.normalizeHashtags = normalizeHashtags;
exports.cleanupAIPayload = cleanupAIPayload;
exports.enrichMetadataWithHashtagFallbacks = enrichMetadataWithHashtagFallbacks;
function normalizeTag(raw) {
    if (!raw)
        return null;
    const trimmed = raw.trim().replace(/^#+/, '').toLowerCase();
    if (!trimmed)
        return null;
    // Allow letters, numbers, underscore, hyphen. Remove everything else.
    const safe = trimmed.replace(/[^a-z0-9_-]/g, '');
    if (!safe)
        return null;
    return safe.slice(0, 40);
}
function normalizeHashtags(input) {
    const candidates = [];
    const pushFromString = (s) => {
        const str = String(s ?? '').trim();
        if (!str)
            return;
        // If the user typed hashtags (e.g. "#party#narendra" or "#party #narendra"), split by "#".
        const hashtagMatches = str.match(/#[a-z0-9_-]+/gi);
        if (hashtagMatches && hashtagMatches.length > 0) {
            candidates.push(...hashtagMatches);
            return;
        }
        // Fallback: split by whitespace/commas.
        candidates.push(...str.split(/[\s,]+/g));
    };
    if (Array.isArray(input)) {
        input.forEach(v => pushFromString(String(v ?? '')));
    }
    else if (typeof input === 'string') {
        pushFromString(input);
    }
    else if (input == null) {
        // nothing
    }
    else {
        pushFromString(String(input));
    }
    const out = [];
    const seen = new Set();
    for (const c of candidates) {
        const norm = normalizeTag(c);
        if (!norm)
            continue;
        if (seen.has(norm))
            continue;
        seen.add(norm);
        out.push(norm);
        if (out.length >= 20)
            break;
    }
    return out;
}
function cleanupAIPayload(rawMetadata, objects = [], scenes = [], ocr = []) {
    const personCount = Number(rawMetadata.person_count || 0);
    const synonymMap = {
        'laptop_computer': 'laptop',
        'tv_monitor': 'screen',
        'cellular_phone': 'phone',
        'wrist_watch': 'watch'
    };
    const normalizeStr = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    // 1. Clean Objects with Strict Confidence Threshold (Fix 1: >= 0.60)
    const cleanObjNames = new Set();
    const cleanObjectsArr = [];
    objects.forEach(obj => {
        const confidence = typeof obj === 'object' && obj !== null ? Number(obj.confidence ?? 0) : 1.0;
        if (confidence < 0.60)
            return; // Filter weak object detections
        const rawName = typeof obj === 'string' ? obj : (obj.name || '');
        const baseNorm = normalizeStr(rawName);
        if (!baseNorm || baseNorm === 'person' || baseNorm === 'people')
            return;
        const mapped = synonymMap[baseNorm] || baseNorm;
        if (cleanObjNames.has(mapped))
            return;
        cleanObjNames.add(mapped);
        cleanObjectsArr.push(typeof obj === 'string' ? mapped : { ...obj, name: mapped });
    });
    // 2. Clean OCR
    const cleanOcrSet = new Set();
    ocr.forEach(txt => {
        const val = String(txt || '').trim();
        if (val.length <= 1)
            return; // Skip single char
        if (/^\d+$/.test(val.replace(/[^0-9]/g, '')))
            return; // Skip pure numbers
        cleanOcrSet.add(val);
    });
    const cleanOcrArr = Array.from(cleanOcrSet);
    // 3. Clean Scenes with Strict Confidence Threshold (Fix 1: >= 0.45)
    const cleanScenesArr = [];
    const seenSceneLabels = new Set();
    const sortedScenes = [...scenes].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    sortedScenes.forEach(s => {
        const conf = Number(s.confidence || 0);
        if (conf < 0.45)
            return; // Filter weak scene detections
        const lab = normalizeStr(s.label);
        if (!lab || seenSceneLabels.has(lab))
            return;
        seenSceneLabels.add(lab);
        cleanScenesArr.push(s);
    });
    // 4. Derive Intelligence Streams: Activities & Environment
    const activitiesSet = new Set();
    const environmentSet = new Set();
    const activityKeywords = [
        'party', 'picnic', 'wedding', 'birthday', 'event', 'vacation', 'travel', 'graduation', 'sports', 'meeting', 'working'
    ];
    const envKeywords = [
        'indoor', 'outdoor', 'nature', 'city', 'beach', 'forest', 'mountain', 'scenic', 'office', 'campus'
    ];
    cleanScenesArr.forEach(sc => {
        const label = sc.label.toLowerCase();
        if (activityKeywords.some(k => label.includes(k))) {
            activitiesSet.add(sc.label);
        }
        if (envKeywords.some(k => label.includes(k))) {
            environmentSet.add(sc.label);
        }
    });
    // Smart heuristics
    if (cleanObjNames.has('laptop') || cleanObjNames.has('keyboard')) {
        activitiesSet.add('working');
    }
    if (personCount > 1 && (seenSceneLabels.has('party') || seenSceneLabels.has('birthday'))) {
        activitiesSet.add('celebration');
    }
    const cleanActivities = Array.from(activitiesSet);
    const cleanEnvironment = Array.from(environmentSet);
    // 5. Highly Specific AI Summary Generation (Requirement 5)
    const objectsList = Array.from(cleanObjNames).map(o => o.replace(/_/g, ' '));
    const topScenes = cleanScenesArr.map(s => s.label.toLowerCase().trim());
    let summarySegments = [];
    if (personCount === 1) {
        summarySegments.push("1 person");
    }
    else if (personCount > 1) {
        summarySegments.push(`${personCount} people`);
    }
    else {
        summarySegments.push("A visual capture");
    }
    if (topScenes.length > 0) {
        const primaryScene = topScenes[0];
        if (primaryScene === 'unknown') {
            // Safely skip unknown scenes to prevent linguistic garbage (Requirement 4)
        }
        else if (primaryScene.includes("indoor")) {
            summarySegments.push("indoors");
        }
        else if (primaryScene.includes("outdoor") || primaryScene.includes("nature")) {
            summarySegments.push("outdoors");
        }
        else {
            summarySegments.push(`in an ${primaryScene.replace(/\/.*/, '')}`); // e.g., "in an office"
        }
    }
    if (objectsList.length > 0) {
        // Contextual action mapping for elegant human-like summaries (Requirement 5)
        const actionMap = {
            'laptop': 'using laptop',
            'phone': 'on a phone',
            'keyboard': 'at a keyboard',
            'couch/sofa': 'on a couch',
            'chair': 'sitting',
            'monitor/screen': 'near a screen'
        };
        const candidateActionKey = Object.keys(actionMap).find(key => objectsList.includes(key));
        if (candidateActionKey && personCount > 0) {
            const actionPhrase = actionMap[candidateActionKey];
            const extraObjects = objectsList.filter(o => o !== candidateActionKey);
            let phrase = actionPhrase;
            if (extraObjects.length > 0) {
                phrase += ` with ${extraObjects.join(', ')}`;
            }
            summarySegments.push(phrase);
        }
        else {
            const formattedObjects = objectsList.length === 1
                ? `featuring a ${objectsList[0]}`
                : `featuring ${objectsList.join(', ')}`;
            summarySegments.push(formattedObjects);
        }
    }
    let dynamicCaption = summarySegments.join(" ");
    if (dynamicCaption === "A visual capture") {
        dynamicCaption = "Analysis completed with minimal distinguishable entities identified.";
    }
    else {
        // Ensure clean whitespace handling in join
        dynamicCaption = dynamicCaption.replace(/\s+/g, ' ').trim() + ".";
    }
    dynamicCaption = dynamicCaption.charAt(0).toUpperCase() + dynamicCaption.slice(1);
    // 6. Build Auto Hashtags
    const autoTags = new Set();
    if (personCount > 0) {
        if (personCount === 1) {
            autoTags.add('1_person');
            autoTags.add('portrait');
        }
        else {
            autoTags.add(`${personCount}_people`);
            autoTags.add('group_photo');
        }
    }
    if (rawMetadata.orientation) {
        autoTags.add(normalizeStr(rawMetadata.orientation));
    }
    cleanObjNames.forEach(n => autoTags.add(n));
    cleanScenesArr.forEach(sc => {
        autoTags.add(normalizeStr(sc.label));
    });
    // Incorporate useful OCR tokens if readable (Requirement 4)
    cleanOcrArr.forEach(txt => {
        const word = normalizeStr(txt);
        if (word.length >= 3 && word.length <= 15 && !/^[0-9]+$/.test(word)) {
            autoTags.add(word);
        }
    });
    const finalTags = normalizeHashtags(Array.from(autoTags));
    return {
        cleanObjects: cleanObjectsArr,
        cleanScenes: cleanScenesArr,
        cleanOcr: cleanOcrArr,
        cleanActivities,
        cleanEnvironment,
        caption: dynamicCaption,
        autoHashtags: finalTags
    };
}
function enrichMetadataWithHashtagFallbacks(hashtags, existingObjects = [], existingScenes = [], existingPeopleCount = 0, existingCaption = "") {
    const synonymMap = {
        'laptop_computer': 'laptop',
        'tv_monitor': 'screen',
        'cellular_phone': 'phone',
        'wrist_watch': 'watch'
    };
    const tagToObjectMap = {
        laptop: "laptop",
        phone: "phone",
        screen: "screen",
        chair: "chair",
        couch: "couch/sofa",
        sofa: "couch/sofa",
        keyboard: "keyboard",
        mouse: "mouse",
        watch: "watch",
        backpack: "backpack",
        bottle: "bottle"
    };
    const tagToSceneMap = {
        office_event: "office/workspace",
        office: "office/workspace",
        group_photo: "group photo",
        landscape: "outdoor/nature",
        indoor: "indoor",
        nature: "nature"
    };
    // 1. Resolve clean lists from previous executions
    const objectNames = new Set(existingObjects.map(o => {
        const name = typeof o === 'string' ? o : (o.name || '');
        const norm = name.toLowerCase().trim();
        return synonymMap[norm] || norm;
    }).filter(Boolean));
    const sceneLabels = new Set(existingScenes.map(s => {
        const label = typeof s === 'string' ? s : (s.label || '');
        return label.toLowerCase().trim();
    }).filter(Boolean));
    let derivedPeopleCount = Number(existingPeopleCount || 0);
    // 2. Parse hashtag stream and map fallback structures (Requirement 3)
    hashtags.forEach(t => {
        const clean = String(t || '').replace(/^#/, '').trim().toLowerCase();
        if (!clean)
            return;
        // Object Maps
        if (tagToObjectMap[clean]) {
            objectNames.add(tagToObjectMap[clean]);
        }
        else if (clean.includes('laptop')) {
            objectNames.add('laptop');
        }
        else if (clean.includes('phone')) {
            objectNames.add('phone');
        }
        else if (clean.includes('screen')) {
            objectNames.add('screen');
        }
        // Scene Maps
        if (tagToSceneMap[clean]) {
            sceneLabels.add(tagToSceneMap[clean]);
        }
        // People Count derivation from tags
        if (clean === 'person' || clean === '1_person') {
            if (derivedPeopleCount === 0)
                derivedPeopleCount = 1;
        }
        else {
            const match = clean.match(/^(\d+)[_-]peop/);
            if (match) {
                const c = parseInt(match[1], 10);
                if (c > derivedPeopleCount)
                    derivedPeopleCount = c;
            }
        }
    });
    const finalObjects = Array.from(objectNames);
    const finalScenes = Array.from(sceneLabels);
    // Wrap back in objects for consistent metadata indexing
    const formattedObjects = finalObjects.map(name => {
        const found = existingObjects.find(o => (typeof o === 'string' ? o : o.name).toLowerCase() === name);
        return found || { name, confidence: 0.95 };
    });
    const formattedScenes = finalScenes.map(label => {
        const found = existingScenes.find(s => (typeof s === 'string' ? s : s.label).toLowerCase() === label);
        return found || { label, confidence: 0.95 };
    });
    // 3. Build Robust Analytical Summary (Requirement 5)
    let finalCaption = String(existingCaption || '').trim();
    const isGeneric = !finalCaption ||
        finalCaption.toLowerCase() === "a photograph." ||
        finalCaption.toLowerCase().includes("completed with basic") ||
        finalCaption.toLowerCase().includes("image processed successfully");
    if (isGeneric) {
        let segments = [];
        if (derivedPeopleCount === 1) {
            segments.push("Portrait of one person");
        }
        else if (derivedPeopleCount > 1) {
            segments.push(`${derivedPeopleCount} people`);
        }
        else {
            segments.push("An image");
        }
        if (finalScenes.length > 0) {
            const primaryScene = finalScenes[0];
            if (primaryScene.includes("indoor")) {
                segments.push("indoors");
            }
            else if (primaryScene.includes("outdoor") || primaryScene.includes("nature")) {
                segments.push("outdoors");
            }
            else {
                segments.push(`situated in ${primaryScene}`);
            }
        }
        if (finalObjects.length > 0) {
            const formattedObjects = finalObjects.length === 1
                ? `featuring a ${finalObjects[0]}`
                : `featuring ${finalObjects.join(', ')}`;
            segments.push(formattedObjects);
        }
        finalCaption = segments.join(" ");
        if (finalCaption === "An image") {
            finalCaption = "Analysis completed with minimal physical features identified.";
        }
        else {
            finalCaption += ".";
        }
        finalCaption = finalCaption.charAt(0).toUpperCase() + finalCaption.slice(1);
    }
    return {
        objects: formattedObjects,
        scenes: formattedScenes,
        peopleCount: derivedPeopleCount,
        caption: finalCaption,
    };
}
//# sourceMappingURL=hashtagUtils.js.map