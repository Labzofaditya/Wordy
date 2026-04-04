import { useState, useCallback } from 'react';
import { FileUp, Check, AlertCircle, Loader2 } from 'lucide-react';
import { parseKindleVocabDb, removeDuplicates } from '../lib/kindleParser';
import { useWords } from '../hooks/useWords';
import type { VocabStats } from '../types';
import { calculateStats } from '../lib/statsCalculator';

interface UploadResult {
  totalParsed: number;
  uniqueWords: number;
  duplicatesRemoved: number;
  imported: number;
}

export function FileUpload() {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { importWords, words } = useWords();

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith('.db')) {
        setError('Please upload a .db file (Kindle vocab.db)');
        return;
      }

      setUploading(true);
      setError(null);
      setResult(null);

      try {
        const parsedWords = await parseKindleVocabDb(file);
        const { unique, duplicatesCount } = removeDuplicates(parsedWords);
        const imported = await importWords(unique);

        setResult({
          totalParsed: parsedWords.length,
          uniqueWords: unique.length,
          duplicatesRemoved: duplicatesCount,
          imported,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to process file');
      } finally {
        setUploading(false);
      }
    },
    [importWords]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const stats: VocabStats | null = words.length > 0 ? calculateStats(words) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Import Vocabulary</h1>
        <p className="text-slate-600 mt-1">
          Upload your Kindle's vocab.db file to import your vocabulary
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-900 mb-4">How to find vocab.db</h2>
        <ol className="list-decimal list-inside space-y-2 text-slate-600 text-sm">
          <li>Connect your Kindle to your computer via USB</li>
          <li>Navigate to the Kindle's internal storage</li>
          <li>
            Find the file at: <code className="bg-slate-100 px-2 py-0.5 rounded">system/vocabulary/vocab.db</code>
          </li>
          <li>Copy the file to your computer and upload it below</li>
        </ol>
      </div>

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
          isDragging
            ? 'border-teal-500 bg-teal-50'
            : 'border-slate-300 hover:border-slate-400'
        }`}
      >
        <input
          type="file"
          accept=".db"
          onChange={handleInputChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={uploading}
        />

        <div className="flex flex-col items-center">
          {uploading ? (
            <>
              <Loader2 className="h-12 w-12 text-teal-600 animate-spin mb-4" />
              <p className="text-slate-700 font-medium">Processing vocabulary...</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <FileUp className="h-8 w-8 text-slate-500" />
              </div>
              <p className="text-slate-700 font-medium mb-1">
                Drop your vocab.db file here
              </p>
              <p className="text-slate-500 text-sm">or click to browse</p>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-800">Import Failed</p>
            <p className="text-red-700 text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {result && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
              <Check className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-emerald-800">Import Successful</p>
              <p className="text-emerald-700 text-sm">Your vocabulary has been imported</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-3 border border-emerald-200">
              <p className="text-2xl font-bold text-slate-900">{result.totalParsed}</p>
              <p className="text-sm text-slate-600">Total Parsed</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-emerald-200">
              <p className="text-2xl font-bold text-slate-900">{result.uniqueWords}</p>
              <p className="text-sm text-slate-600">Unique Words</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-emerald-200">
              <p className="text-2xl font-bold text-slate-900">{result.duplicatesRemoved}</p>
              <p className="text-sm text-slate-600">Duplicates</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-emerald-200">
              <p className="text-2xl font-bold text-teal-600">{result.imported}</p>
              <p className="text-sm text-slate-600">Imported</p>
            </div>
          </div>
        </div>
      )}

      {stats && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Current Library Stats</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-2xl font-bold text-slate-900">{stats.totalWords}</p>
              <p className="text-sm text-slate-600">Total Words</p>
            </div>
            <div className="p-4 bg-emerald-50 rounded-lg">
              <p className="text-2xl font-bold text-emerald-600">{stats.masteredCount}</p>
              <p className="text-sm text-slate-600">Mastered</p>
              <p className="text-xs text-slate-400">High retention</p>
            </div>
            <div className="p-4 bg-amber-50 rounded-lg">
              <p className="text-2xl font-bold text-amber-600">{stats.learningCount}</p>
              <p className="text-sm text-slate-600">Learning</p>
              <p className="text-xs text-slate-400">Being studied</p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{stats.newCount}</p>
              <p className="text-sm text-slate-600">New</p>
              <p className="text-xs text-slate-400">Not yet reviewed</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-3">Words by Length</h3>
              <div className="space-y-2">
                {Object.entries(stats.wordsByLength)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .slice(0, 8)
                  .map(([length, count]) => (
                    <div key={length} className="flex items-center gap-2">
                      <span className="text-sm text-slate-600 w-16">{length} chars</span>
                      <div className="flex-1 bg-slate-100 rounded-full h-2">
                        <div
                          className="bg-teal-500 h-2 rounded-full"
                          style={{
                            width: `${(count / stats.totalWords) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm text-slate-500 w-10 text-right">{count}</span>
                    </div>
                  ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-3">Words by First Letter</h3>
              <div className="flex flex-wrap gap-1">
                {Object.entries(stats.wordsByFirstLetter)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([letter, count]) => (
                    <div
                      key={letter}
                      className="w-10 h-10 bg-slate-100 rounded flex flex-col items-center justify-center"
                      title={`${letter}: ${count} words`}
                    >
                      <span className="text-sm font-medium text-slate-700">{letter}</span>
                      <span className="text-xs text-slate-500">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
