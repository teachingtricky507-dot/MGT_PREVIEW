import { storage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export const uploadService = {
  uploadFile: async (projectId: string, issueId: string, file: File) => {
    const fileRef = ref(storage, `projects/${projectId}/issues/${issueId}/${Date.now()}_${file.name}`);
    const snapshot = await uploadBytes(fileRef, file);
    const url = await getDownloadURL(snapshot.ref);
    
    return {
      name: file.name,
      url: url,
      size: file.size,
      type: file.type
    };
  }
};
