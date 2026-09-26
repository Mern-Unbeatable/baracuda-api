export class TranslateUtil {
  static async translateText(text, targetLang, sourceLang = 'auto') {
    if (!text || !targetLang || (sourceLang === 'en' && targetLang === 'en')) return text;

    try {
      const res = await fetch('https://translate.baracuda260.maktechgroup.tech/translate', {
        method: 'POST',
        body: JSON.stringify({
          q: text,
          source: sourceLang,
          target: targetLang,
          format: 'text',
          api_key: ''
        }),
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await res.json();
      return data.translatedText || text;
    } catch (error) {
      console.error('Translation error:', error);
      return text;
    }
  }
}
