// frontend/lib/get-profile-api.ts
import api from './api';

export const getProfilePicture = async (photoLocation: any, userData: any) => {
  try {
    const response = await api.post('/proxy-upload', {
      method: "upload.getFile",
      param: {
        location: {
          "_": "inputPeerPhotoFileLocation",
          "pFlags": {},
          "photo_id": photoLocation.photo_id,
          "local_id": photoLocation.local_id,
          "volume_id": photoLocation.volume_id,
          "peer": {
            "_": "inputPeerUser",
            "user_id": userData.id,
            "access_hash": userData.access_hash
          }
        },
        offset: 0,
        limit: 524288
      },
      token: process.env.NEXT_PUBLIC_EITAA_TOKEN,
      imei: process.env.NEXT_PUBLIC_EITAA_IMEI
    });

    // اینجا همون bytes که توی عکس فرستادی رو می‌گیریم
    const resData = response.data;
    
    if (resData && resData.bytes) {
      // تبدیل آبجکت بایت‌ها به آرایه عددی
      const byteArr = Object.values(resData.bytes) as number[];
      const uint8 = new Uint8Array(byteArr);
      
      // تبدیل به Base64 با روش بهینه برای عکس‌های بزرگ
      let binary = '';
      uint8.forEach(b => binary += String.fromCharCode(b));
      const base64 = window.btoa(binary);

      return `data:image/jpeg;base64,${base64}`;
    }
    
    return null;
  } catch (error) {
    console.error("Error in getProfilePicture:", error);
    return null;
  }
};