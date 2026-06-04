// frontend/src/utils/imageCache.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export const cacheImage = async (url: string, key: string): Promise<string> => {
    if (!url) return '';
    
    try {
        // Check cache
        const cached = await AsyncStorage.getItem(`img_cache_${key}`);
        if (cached) {
            console.log(`✅ Using cached URL for ${key}`);
            return cached;
        }
        
        // Cache the URL itself (not the file)
        await AsyncStorage.setItem(`img_cache_${key}`, url);
        console.log(`💾 URL cached: ${key}`);
        
        return url;
    } catch (error) {
        console.log(`Cache failed: ${key}`, error);
        return url;
    }
};