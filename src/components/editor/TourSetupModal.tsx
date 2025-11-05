import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, RotateCw, ImageIcon, Home, Camera, X, Sparkles, ArrowRight, Check, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import ImageEditor from "./ImageEditor";
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import { optimizeImage, validateImageFile, formatFileSize } from '@/utils/imageOptimization';

const ProgressBar = ({ current, total }: { current: number; total: number }) => {
  const { t } = useTranslation();
  const percentage = (current / total) * 100;
  return (
    <div className="w-full bg-slate-200 rounded-full h-3 mb-3">
      <div
        className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-500 shadow-sm"
        style={{ width: `${percentage}%` }}
      ></div>
      <div className="flex justify-between mt-1 text-xs text-slate-500">
        <span>{t('tourSetup.step')} {current} {t('tourSetup.of')} {total}</span>
        <span>{Math.round(percentage)}% {t('tourSetup.completed')}</span>
      </div>
    </div>
  );
};

interface TourSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (tourData: any) => void;
  isSaving: boolean;
  tourType?: '360' | 'photos' | null;
}

export default function TourSetupModal({ isOpen, onClose, onConfirm, isSaving, tourType }: TourSetupModalProps) {
  const { t } = useTranslation();
  const [tourData, setTourData] = useState({
    title: '',
    description: '',
    thumbnail_url: '',
  });
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<any>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;
  const [isEditingThumbnail, setIsEditingThumbnail] = useState(false);
  const [selectedThumbnailFile, setSelectedThumbnailFile] = useState<File | null>(null);
  const [showCoverSizeDialog, setShowCoverSizeDialog] = useState(false);
  const [pendingCoverFile, setPendingCoverFile] = useState<File | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const validateCurrentStep = () => {
    let isValid = true;
    const newErrors: Record<string, string> = {};

    switch(currentStep) {
      case 1:
        if (!tourData.title.trim()) {
          isValid = false;
          newErrors.title = t('tourSetup.titleRequired');
        }
        break;
      case 2:
        // Descripción es opcional, no validar
        break;
      default:
        break;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleInputChange = (field: string, value: string) => {
    setTourData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined as any }));
    }
  };

  const handleNextStep = () => {
    if (validateCurrentStep()) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevStep = () => {
    setCurrentStep(prev => prev - 1);
    setErrors({});
    setServerError(null);
  };

  const uploadFileWithRetry = async (file: File, maxRetries = 3) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const fileName = `${Date.now()}_${file.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('tour-images')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('tour-images')
          .getPublicUrl(fileName);

        return publicUrl;
      } catch (error) {
        console.error(`Intento ${attempt} falló:`, error);
        if (attempt === maxRetries) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  };

  const handleCoverFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setErrors(prev => ({ ...prev, thumbnail_url: undefined as any }));
      return;
    }

    const validation = validateImageFile(file);
    if (!validation.valid) {
      setErrors(prev => ({ ...prev, thumbnail_url: validation.error }));
      e.target.value = '';
      return;
    }

    setErrors(prev => ({ ...prev, thumbnail_url: undefined as any }));
    setServerError(null);
    setSelectedThumbnailFile(file);
    setIsEditingThumbnail(true);
    e.target.value = '';
  };

  const handleThumbnailEditorSave = async (editedFile: File) => {
    setIsUploadingCover(true);
    setIsEditingThumbnail(false);
    setSelectedThumbnailFile(null);
    try {
      // Optimize the edited image
      const result = await optimizeImage(editedFile, {
        maxWidth: 4000,
        quality: 0.85,
        format: 'webp',
        maxSizeMB: 10
      });

      const timestamp = Date.now();
      const fileName = `covers/${timestamp}_cover.${result.format}`;

      const { error: uploadError } = await supabase.storage
        .from('tour-images')
        .upload(fileName, result.blob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('tour-images')
        .getPublicUrl(fileName);

      setTourData(prev => ({ ...prev, thumbnail_url: publicUrl }));
    } catch (err) {
      console.error("Error uploading edited thumbnail:", err);
      setErrors(prev => ({ ...prev, thumbnail_url: t('tourSetup.imageError') }));
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handleFinalConfirm = () => {
    if (tourData.title.trim()) {
      // Convertir thumbnail_url a coverImageUrl para el Dashboard
      onConfirm({
        title: tourData.title,
        description: tourData.description,
        coverImageUrl: tourData.thumbnail_url,
      });
    }
  };

  const resetModal = () => {
    setTourData({ title: '', description: '', thumbnail_url: '' });
    setCurrentStep(1);
    setErrors({});
    setServerError(null);
    setIsEditingThumbnail(false);
    setSelectedThumbnailFile(null);
    setShowCoverSizeDialog(false);
    setPendingCoverFile(null);
  };

  const handleCloseModal = () => {
    resetModal();
    onClose();
  };

  const handleCoverSizeReductionConfirm = async () => {
    setShowCoverSizeDialog(false);
    if (pendingCoverFile) {
      setSelectedThumbnailFile(pendingCoverFile);
      setIsEditingThumbnail(true);
      setPendingCoverFile(null);
    }
  };

  const handleCoverSizeReductionCancel = () => {
    setShowCoverSizeDialog(false);
    setPendingCoverFile(null);
    setErrors(prev => ({ ...prev, thumbnail_url: t('tourSetup.imageTooLarge') }));
  };

  if (!isOpen && !isEditingThumbnail && !showCoverSizeDialog) return null;

  return (
    <>
      <input
        type="file"
        ref={coverInputRef}
        onChange={handleCoverFileChange}
        className="hidden"
        accept="image/png, image/jpeg, image/webp"
      />

      {isEditingThumbnail && selectedThumbnailFile && (
        <Dialog open={true} onOpenChange={() => {
          setIsEditingThumbnail(false);
          setSelectedThumbnailFile(null);
        }}>
          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-y-auto">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>{t('tourSetup.editImage')}</DialogTitle>
              <DialogDescription>{t('tourSetup.adjustImage')}</DialogDescription>
            </DialogHeader>
            <div className="h-[600px] w-full flex-shrink-0">
              <ImageEditor
                imageFile={selectedThumbnailFile}
                onSave={handleThumbnailEditorSave}
                onCancel={() => {
                  setIsEditingThumbnail(false);
                  setSelectedThumbnailFile(null);
                }}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={isOpen && !isEditingThumbnail && !showCoverSizeDialog} onOpenChange={handleCloseModal}>
        <DialogContent className="max-w-2xl sm:max-w-4xl h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-4 pb-2 border-b bg-gradient-to-r from-blue-50 to-purple-50 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl shadow-lg">
                <Home className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg sm:text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  {t('tourSetup.title')}
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">
                  {t('tourSetup.subtitle')}
                </DialogDescription>
              </div>
            </div>
            {tourType && (
              <div className="text-center pt-1">
                <span className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                  {tourType === '360' ? '🌐 Tours 360°' : '📸 Tours de Fotos'}
                </span>
              </div>
            )}
          </DialogHeader>

          <ScrollArea className="flex-1">
            <div className="p-4 pt-0">
              <ProgressBar current={currentStep} total={totalSteps} />

              {serverError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3"
                >
                  <div className="flex items-center gap-1 mb-1">
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                    <h4 className="font-semibold text-amber-800">{t('tourSetup.connectionProblem')}</h4>
                  </div>
                  <p className="text-amber-700 mb-2">{serverError.message}</p>
                </motion.div>
              )}

              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-3 sm:space-y-4 min-h-[200px] sm:min-h-[250px]"
                >
                  {currentStep === 1 && (
                    <div className="space-y-3 text-center">
                      <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto shadow-lg">
                        <Sparkles className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl sm:text-2xl font-bold text-slate-800 mb-1">{t('tourSetup.step1Title')}</h3>
                        <p className="text-base sm:text-lg font-semibold text-blue-600 mb-2">{t('tourSetup.step1Question')}</p>
                        <p className="text-sm text-slate-500 mb-4">{t('tourSetup.step1Description')}</p>
                      </div>
                      <div className="max-w-md mx-auto">
                        <Input
                          value={tourData.title}
                          onChange={(e) => handleInputChange('title', e.target.value)}
                          placeholder={t('tourSetup.step1Placeholder')}
                          className={`text-base sm:text-lg h-10 sm:h-12 text-center ${errors.title ? 'border-red-500' : 'border-blue-300 focus:border-blue-500'}`}
                        />
                        {errors.title && <p className="text-red-500 text-sm mt-2">{errors.title}</p>}
                      </div>
                    </div>
                  )}

                  {currentStep === 2 && (
                    <div className="space-y-3 text-center">
                      <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center mx-auto shadow-lg">
                        <ImageIcon className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl sm:text-2xl font-bold text-slate-800 mb-1">{t('tourSetup.step2Title')}</h3>
                        <p className="text-base sm:text-lg font-semibold text-green-600 mb-2">{t('tourSetup.step2Question')}</p>
                        <p className="text-sm text-slate-500 mb-4">{t('tourSetup.step2Description')}</p>
                      </div>
                      <div className="max-w-md mx-auto">
                        <Textarea
                          value={tourData.description}
                          onChange={(e) => handleInputChange('description', e.target.value)}
                          placeholder={t('tourSetup.step2Placeholder')}
                          rows={4}
                          className={`text-center ${errors.description ? 'border-red-500' : 'border-green-300 focus:border-green-500'}`}
                        />
                        {errors.description && <p className="text-red-500 text-sm mt-2">{errors.description}</p>}
                      </div>
                    </div>
                  )}

                  {currentStep === 3 && (
                    <div className="space-y-3 text-center">
                      <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto shadow-lg">
                        <Camera className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl sm:text-2xl font-bold text-slate-800 mb-1">{t('tourSetup.step3Title')}</h3>
                        <p className="text-base sm:text-lg font-semibold text-purple-600 mb-2">{t('tourSetup.step3Question')}</p>
                        <p className="text-sm text-slate-500 mb-4">{t('tourSetup.step3Description')}</p>
                      </div>

                      {tourData.thumbnail_url ? (
                        <div className="max-w-sm mx-auto">
                          <img
                            src={tourData.thumbnail_url}
                            alt="Portada"
                            className="w-full h-28 sm:h-36 object-cover rounded-lg border-2 border-purple-300 shadow-lg"
                          />
                          <p className="text-sm text-green-600 font-semibold mt-2">{t('tourSetup.uploadSuccess')}</p>
                          <Button
                            variant="outline"
                            onClick={() => coverInputRef.current?.click()}
                            disabled={isUploadingCover}
                            className="mt-3"
                          >
                            {t('tourSetup.changeImage')}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          onClick={() => coverInputRef.current?.click()}
                          disabled={isUploadingCover}
                          variant="outline"
                          className="w-48 sm:w-64 h-16 sm:h-20 mx-auto border-dashed border-2 border-purple-300"
                        >
                          {isUploadingCover ? (
                            <>
                              <RotateCw className="w-5 h-5 sm:w-6 sm:h-6 mr-2 animate-spin" />
                              {t('common.uploading')}
                            </>
                          ) : (
                            <>
                              <Upload className="w-5 h-5 sm:w-6 sm:h-6 mr-2" />
                              {t('tourSetup.clickToUpload')}
                            </>
                          )}
                        </Button>
                      )}
                      {errors.thumbnail_url && <p className="text-red-500 text-sm mt-2">{errors.thumbnail_url}</p>}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </ScrollArea>

          <DialogFooter className="p-4 pt-3 border-t bg-gradient-to-r from-slate-50 to-blue-50 flex-shrink-0">
            <div className="flex justify-between w-full gap-2">
              <Button
                variant="outline"
                onClick={currentStep === 1 ? handleCloseModal : handlePrevStep}
                disabled={isSaving}
                className="px-3 sm:px-4 text-sm sm:text-base"
              >
                {currentStep === 1 ? t('common.cancel') : t('common.previous')}
              </Button>

              <div className="flex gap-2 sm:gap-3">
                {currentStep < totalSteps && (
                  <Button
                    onClick={handleNextStep}
                    disabled={
                      (currentStep === 1 && !tourData.title.trim()) ||
                      isUploadingCover ||
                      !!serverError
                    }
                    className="bg-gradient-to-r from-blue-500 to-purple-600"
                  >
                    <ArrowRight className="w-4 h-4 mr-1 sm:mr-2" />
                    {t('common.next')}
                  </Button>
                )}

                {currentStep === totalSteps && (
                  <Button
                    onClick={handleFinalConfirm}
                    disabled={isSaving || !tourData.title.trim()}
                    className="bg-gradient-to-r from-green-500 to-blue-500"
                  >
                    {isSaving ? (
                      <>
                        <RotateCw className="w-4 h-4 mr-1 sm:mr-2 animate-spin" />
                        {t('tourSetup.creating')}
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-1 sm:mr-2" />
                        {t('tourSetup.createTour')}
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCoverSizeDialog} onOpenChange={handleCoverSizeReductionCancel}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              {t('tourSetup.imageTooLargeTitle')}
            </DialogTitle>
            <DialogDescription>
              {pendingCoverFile && (
                <>
                  {t('tourSetup.imageWeighs')} <strong>{(pendingCoverFile.size / 1024 / 1024).toFixed(1)}MB</strong>.
                  {t('tourSetup.optimizeQuestion')}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={handleCoverSizeReductionCancel}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleCoverSizeReductionConfirm} className="bg-green-600">
              <Check className="w-4 h-4 mr-2" />
              {t('tourSetup.yesOptimize')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
