import { useState, useRef } from 'react';
import { FiX, FiUpload, FiLink, FiImage } from 'react-icons/fi';
import api from '../../lib/api';
import toast from 'react-hot-toast';

export default function PhotoUploadModal({ product, onSave, onClose }) {
  const [tab, setTab] = useState('upload'); // 'upload' | 'url'
  const [imageUrl, setImageUrl] = useState(product.images?.[0] || '');
  const [preview, setPreview] = useState(product.images?.[0] || '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Only image files allowed');
    if (file.size > 5 * 1024 * 1024) return toast.error('Max file size is 5 MB');

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const { data } = await api.post(`/products/${product._id}/upload-image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (data.success) {
        setPreview(data.imageUrl);
        setImageUrl(data.imageUrl);
        toast.success('Photo uploaded');
        onSave(data.imageUrl);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally { setUploading(false); }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const saveUrl = async () => {
    setSaving(true);
    try {
      const images = imageUrl.trim() ? [imageUrl.trim()] : [];
      await api.patch(`/products/${product._id}`, { images });
      setPreview(imageUrl.trim());
      toast.success('Photo saved');
      onSave(imageUrl.trim() || null);
    } catch { toast.error('Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="font-bold text-gray-900">Product Photo</h2>
            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[280px]">{product.name?.ru}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <FiX size={18} />
          </button>
        </div>

        <div className="p-6">
          {/* Preview */}
          {preview && (
            <div className="mb-4 rounded-xl overflow-hidden border border-gray-100 h-48 bg-gray-50 flex items-center justify-center relative">
              <img src={preview} alt="preview" className="max-h-full max-w-full object-contain"
                onError={e => { e.target.style.display = 'none'; }} />
              <button onClick={() => { setPreview(''); setImageUrl(''); }}
                className="absolute top-2 right-2 bg-white rounded-full p-1 shadow text-gray-400 hover:text-red-500">
                <FiX size={14} />
              </button>
            </div>
          )}

          {/* Tabs */}
          <div className="flex rounded-xl border border-gray-200 overflow-hidden mb-4">
            <button onClick={() => setTab('upload')}
              className={`flex-1 py-2 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${tab === 'upload' ? 'bg-primary-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
              <FiUpload size={14} /> Upload File
            </button>
            <button onClick={() => setTab('url')}
              className={`flex-1 py-2 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${tab === 'url' ? 'bg-primary-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
              <FiLink size={14} /> Image URL
            </button>
          </div>

          {tab === 'upload' ? (
            <div
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${dragOver ? 'border-primary-400 bg-primary-50' : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'}`}
            >
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={e => handleFile(e.target.files?.[0])} />
              {uploading ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-gray-500">Uploading…</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center">
                    <FiImage size={24} className="text-primary-400" />
                  </div>
                  <p className="text-sm font-semibold text-gray-700">Click or drag & drop</p>
                  <p className="text-xs text-gray-400">PNG, JPG, WEBP up to 5 MB</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <input
                className="input text-sm"
                placeholder="https://example.com/product.jpg"
                value={imageUrl}
                onChange={e => { setImageUrl(e.target.value); setPreview(e.target.value); }}
              />
              <button onClick={saveUrl} disabled={saving} className="btn-primary w-full">
                {saving ? 'Saving…' : 'Save URL'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
