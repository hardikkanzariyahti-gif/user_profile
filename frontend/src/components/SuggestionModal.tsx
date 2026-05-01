import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, CheckCircle2, AlertCircle, ChevronRight, Loader2, Image as ImageIcon } from 'lucide-react';

interface FaceSuggestion {
  faceIndex: number;
  box: { _x: number; _y: number; _width: number; _height: number };
  confidence: number;
  isConfident: boolean;
  topSuggestion: { id: number; name: string; confidence: number; distance: number } | null;
  allSuggestions: Array<{ id: number; name: string; confidence: number; distance: number }>;
  label: string;
  reason: string | null;
}

interface SuggestionData {
  itemId: number;
  url: string;
  faces: FaceSuggestion[];
  highConfidenceCount: number;
  lowConfidenceCount: number;
}

interface SuggestionModalProps {
  suggestion: SuggestionData | null;
  allUsers: Array<{ id: number; name: string; profilePicture?: string }>;
  onConfirmTag: (faceIndex: number, userId: number) => Promise<void>;
  onDismiss: () => void;
  onSkip: () => void;
}

const SuggestionModal: React.FC<SuggestionModalProps> = ({
  suggestion,
  allUsers,
  onConfirmTag,
  onDismiss,
  onSkip,
}) => {
  const [selectedFaces, setSelectedFaces] = useState<Set<number>>(new Set());
  const [taggingFace, setTaggingFace] = useState<number | null>(null);
  const [activeFace, setActiveFace] = useState<number | null>(null);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    if (suggestion) {
      setSelectedFaces(new Set());
      setActiveFace(null);
      setShowUserPicker(false);
      setImageLoaded(false);
    }
  }, [suggestion?.itemId]);

  if (!suggestion) return null;

  const lowConfidenceFaces = suggestion.faces.filter(f => !f.isConfident);
  const highConfidenceFaces = suggestion.faces.filter(f => f.isConfident);

  const filteredUsers = allUsers.filter(u =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleFaceClick = (faceIndex: number) => {
    setActiveFace(faceIndex === activeFace ? null : faceIndex);
    setShowUserPicker(false);
    setSearchQuery('');
  };

  const handleSelectUser = async (userId: number) => {
    if (activeFace === null) return;

    setTaggingFace(activeFace);
    setShowUserPicker(false);

    try {
      await onConfirmTag(activeFace, userId);
      setSelectedFaces(prev => new Set([...prev, activeFace]));
    } catch (error) {
      console.error('Failed to tag face:', error);
    } finally {
      setTaggingFace(null);
      setActiveFace(null);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return '#10b981';
    if (confidence >= 50) return '#f59e0b';
    return '#ef4444';
  };

  const getConfidenceLabel = (confidence: number, isConfident: boolean) => {
    if (isConfident) return 'Auto-tagged';
    if (confidence >= 70) return 'High';
    if (confidence >= 50) return 'Medium';
    if (confidence >= 30) return 'Low';
    return 'Uncertain';
  };

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageRef.current || activeFace !== null) return;

    const rect = imageRef.current.getBoundingClientRect();
    const scaleX = suggestion.faces.length > 0 ? 1 : 1;
    const scaleY = 1;

    const clickX = (e.clientX - rect.left);
    const clickY = (e.clientY - rect.top);

    for (const face of suggestion.faces) {
      if (selectedFaces.has(face.faceIndex)) continue;
      if (face.isConfident) continue;

      const box = face.box;
      if (
        clickX >= box._x &&
        clickX <= box._x + box._width &&
        clickY >= box._y &&
        clickY <= box._y + box._height
      ) {
        handleFaceClick(face.faceIndex);
        return;
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15, 23, 42, 0.92)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 3000,
        padding: '1rem',
      }}
      onClick={onDismiss}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        style={{
          background: 'white',
          borderRadius: '24px',
          maxWidth: '900px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              padding: '10px',
              background: 'rgba(99, 102, 241, 0.1)',
              borderRadius: '12px',
            }}>
              <AlertCircle size={24} color="var(--primary)" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
                Review Face Tags
              </h2>
              <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '0.875rem' }}>
                {suggestion.lowConfidenceCount} face{suggestion.lowConfidenceCount !== 1 ? 's' : ''} need your confirmation
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={onSkip}
              style={{
                padding: '10px 20px',
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                background: 'white',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Skip for now
            </button>
            <button
              onClick={onDismiss}
              style={{
                padding: '10px',
                borderRadius: '12px',
                border: 'none',
                background: '#f3f4f6',
                cursor: 'pointer',
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '1.5rem',
          display: 'grid',
          gridTemplateColumns: suggestion.lowConfidenceCount > 0 ? '1fr 280px' : '1fr',
          gap: '1.5rem',
        }}>
          <div>
            <div
              style={{
                position: 'relative',
                borderRadius: '16px',
                overflow: 'hidden',
                background: '#f3f4f6',
              }}
              onClick={handleImageClick}
            >
              <img
                ref={imageRef}
                src={suggestion.url}
                alt="Gallery item"
                style={{
                  width: '100%',
                  height: 'auto',
                  display: 'block',
                  maxHeight: '500px',
                  objectFit: 'contain',
                }}
                onLoad={() => setImageLoaded(true)}
              />

              {suggestion.faces.map((face, idx) => {
                const isSelected = selectedFaces.has(face.faceIndex);
                const isActive = activeFace === face.faceIndex;
                const isHighConfident = face.isConfident;
                const borderColor = isSelected
                  ? '#10b981'
                  : isActive
                  ? '#3b82f6'
                  : isHighConfident
                  ? '#10b981'
                  : '#f59e0b';

                return (
                  <motion.div
                    key={face.faceIndex}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    style={{
                      position: 'absolute',
                      left: `${face.box._x}px`,
                      top: `${face.box._y}px`,
                      width: `${face.box._width}px`,
                      height: `${face.box._height}px`,
                      border: `3px solid ${borderColor}`,
                      borderRadius: '8px',
                      cursor: isHighConfident || isSelected ? 'default' : 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: isActive ? `0 0 0 4px rgba(59, 130, 246, 0.3)` : 'none',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isHighConfident && !isSelected) {
                        handleFaceClick(face.faceIndex);
                      }
                    }}
                  >
                    {isHighConfident && !isSelected && (
                      <div style={{
                        position: 'absolute',
                        top: '-8px',
                        right: '-8px',
                        width: '24px',
                        height: '24px',
                        background: '#10b981',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '12px',
                        fontWeight: 700,
                      }}>
                        <CheckCircle2 size={16} />
                      </div>
                    )}
                    {isSelected && (
                      <div style={{
                        position: 'absolute',
                        top: '-8px',
                        right: '-8px',
                        width: '24px',
                        height: '24px',
                        background: '#10b981',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '12px',
                        fontWeight: 700,
                      }}>
                        <CheckCircle2 size={16} />
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {lowConfidenceFaces.length > 0 && (
              <div style={{
                marginTop: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}>
                {lowConfidenceFaces.map((face) => {
                  const isSelected = selectedFaces.has(face.faceIndex);
                  const isActive = activeFace === face.faceIndex;
                  const isTagging = taggingFace === face.faceIndex;

                  return (
                    <motion.div
                      key={face.faceIndex}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{
                        padding: '1rem',
                        borderRadius: '12px',
                        border: isActive ? '2px solid #3b82f6' : '2px solid #e5e7eb',
                        background: isActive ? 'rgba(59, 130, 246, 0.05)' : 'white',
                        transition: 'all 0.2s',
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '0.75rem',
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                        }}>
                          <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: getConfidenceColor(face.confidence),
                          }} />
                          <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>
                            Face #{face.faceIndex + 1}
                          </span>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '999px',
                            background: `${getConfidenceColor(face.confidence)}20`,
                            color: getConfidenceColor(face.confidence),
                            fontSize: '0.75rem',
                            fontWeight: 700,
                          }}>
                            {getConfidenceLabel(face.confidence, face.isConfident)}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                          {face.confidence}% match
                        </span>
                      </div>

                      {face.topSuggestion && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          padding: '0.75rem',
                          background: '#f9fafb',
                          borderRadius: '10px',
                        }}>
                          <User size={18} color="#6b7280" />
                          <span style={{ fontWeight: 600 }}>{face.topSuggestion.name}</span>
                          <div style={{
                            marginLeft: 'auto',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                          }}>
                            <div style={{
                              width: '60px',
                              height: '6px',
                              background: '#e5e7eb',
                              borderRadius: '3px',
                              overflow: 'hidden',
                            }}>
                              <div style={{
                                width: `${face.topSuggestion.confidence}%`,
                                height: '100%',
                                background: getConfidenceColor(face.topSuggestion.confidence),
                                borderRadius: '3px',
                              }} />
                            </div>
                            <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                              {face.topSuggestion.confidence}%
                            </span>
                          </div>
                        </div>
                      )}

                      {face.allSuggestions.length > 1 && (
                        <div style={{
                          marginTop: '0.5rem',
                          fontSize: '0.75rem',
                          color: '#6b7280',
                        }}>
                          Also possible: {face.allSuggestions.slice(1, 3).map(s => s.name).join(', ')}
                        </div>
                      )}

                      <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                        {isTagging ? (
                          <button
                            disabled
                            style={{
                              padding: '8px 16px',
                              borderRadius: '10px',
                              background: '#3b82f6',
                              color: 'white',
                              border: 'none',
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                            }}
                          >
                            <Loader2 size={16} className="animate-spin" />
                            Tagging...
                          </button>
                        ) : isSelected ? (
                          <button
                            disabled
                            style={{
                              padding: '8px 16px',
                              borderRadius: '10px',
                              background: '#10b981',
                              color: 'white',
                              border: 'none',
                              fontWeight: 600,
                            }}
                          >
                            <CheckCircle2 size={16} style={{ marginRight: '4px' }} />
                            Tagged
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setActiveFace(face.faceIndex);
                              setShowUserPicker(true);
                            }}
                            style={{
                              padding: '8px 16px',
                              borderRadius: '10px',
                              background: '#3b82f6',
                              color: 'white',
                              border: 'none',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Tag this face
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {showUserPicker && activeFace !== null && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              style={{
                background: '#f9fafb',
                borderRadius: '16px',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                  Select Person
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
                  Face #{activeFace + 1}
                </p>
              </div>

              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Search people..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid #e5e7eb',
                    fontSize: '0.875rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{
                flex: 1,
                overflow: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}>
                {filteredUsers.map(user => (
                  <button
                    key={user.id}
                    onClick={() => handleSelectUser(user.id)}
                    style={{
                      padding: '0.75rem',
                      borderRadius: '10px',
                      border: '1px solid #e5e7eb',
                      background: 'white',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: '#e5e7eb',
                      overflow: 'hidden',
                    }}>
                      {user.profilePicture ? (
                        <img
                          src={user.profilePicture}
                          alt={user.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'var(--primary)',
                          color: 'white',
                          fontWeight: 700,
                          fontSize: '0.875rem',
                        }}>
                          {user.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{user.name}</span>
                    <ChevronRight size={16} style={{ marginLeft: 'auto', color: '#9ca3af' }} />
                  </button>
                ))}

                {filteredUsers.length === 0 && (
                  <div style={{
                    textAlign: 'center',
                    padding: '2rem',
                    color: '#6b7280',
                  }}>
                    <User size={32} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                    <p style={{ margin: 0 }}>No people found</p>
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  setShowUserPicker(false);
                  setActiveFace(null);
                }}
                style={{
                  padding: '10px',
                  borderRadius: '10px',
                  border: '1px solid #e5e7eb',
                  background: 'white',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>
            </motion.div>
          )}
        </div>

        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid #e5e7eb',
          background: '#f9fafb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
            {selectedFaces.size} of {lowConfidenceFaces.length} faces tagged
          </div>
          <button
            onClick={onDismiss}
            style={{
              padding: '12px 24px',
              borderRadius: '12px',
              background: 'var(--primary)',
              color: 'white',
              border: 'none',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default SuggestionModal;