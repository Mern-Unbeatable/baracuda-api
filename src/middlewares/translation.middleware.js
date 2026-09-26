export const translationMiddleware = (req, res, next) => {
  const targetLang = req.headers['accept-language']?.split(',')[0]?.split('-')[0] || req.headers['x-lang'] || 'en';

  const originalJson = res.json;

  res.json = function (data) {
    if (data && typeof data === 'object') {
      data = mapLanguageRecursive(data, targetLang);
    }
    // Restore original method to avoid infinite loops if it's called internally
    res.json = originalJson;
    return originalJson.call(this, data);
  };

  next();
};

const mapLanguageRecursive = (obj, targetLang) => {
  if (Array.isArray(obj)) {
    return obj.map(item => mapLanguageRecursive(item, targetLang));
  }

  if (obj !== null && typeof obj === 'object') {
    const newObj = { ...obj };
    const langSuffix = `_${targetLang}`;

    // Apply translations if the user requested a specific language
    if (targetLang !== 'en') {
      for (const key in newObj) {
         const translatedKey = `${key}${langSuffix}`;
         if (newObj.hasOwnProperty(translatedKey) && newObj[translatedKey] !== null) {
            newObj[key] = newObj[translatedKey];
         }
      }
    }
    
    // Traverse deeper and strictly hide ALL translation fields from the frontend
    const supportedLangs = ['_pl']; // Add other language suffixes here in the future
    
    for (const key in newObj) {
       const isTranslationKey = supportedLangs.some(suffix => key.endsWith(suffix));
       
       if (isTranslationKey) {
          delete newObj[key]; // Clean up the response
       } else if (typeof newObj[key] === 'object' && newObj[key] !== null && !(newObj[key] instanceof Date)) {
          newObj[key] = mapLanguageRecursive(newObj[key], targetLang);
       }
    }
    return newObj;
  }
  return obj;
};
