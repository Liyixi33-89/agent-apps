import { useState, useEffect } from 'react';
import { Settings, Cpu, Eye, MessageSquare } from 'lucide-react';
import { fetchSettings } from '../api';

interface SettingsData {
  activeProvider: string;
  ollama: { baseUrl: string; textModel: string; visionModel: string };
  codebuddy: { baseUrl: string; textModel: string; visionModel: string };
}

const SettingsPage = () => {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings()
      .then(setSettings)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2 mb-6">
        <Settings className="w-6 h-6 text-slate-500" />
        系统设置
      </h1>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-5 bg-slate-100 rounded w-1/3 mb-3" />
              <div className="h-4 bg-slate-100 rounded w-full mb-2" />
              <div className="h-4 bg-slate-100 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : settings && (
        <div className="space-y-4">
          {/* 当前提供商 */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <Cpu className="w-4 h-4 text-sky-600" />
              <h2 className="font-semibold text-slate-700">当前提供商</h2>
            </div>
            <div className="flex items-center gap-3">
              <div className={`px-4 py-2 rounded-lg border text-sm font-medium ${settings.activeProvider === 'ollama' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                🦙 Ollama
              </div>
              <div className={`px-4 py-2 rounded-lg border text-sm font-medium ${settings.activeProvider === 'codebuddy' ? 'bg-sky-50 border-sky-200 text-sky-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                🤖 CodeBuddy
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-3">
              通过环境变量 <code className="text-sky-600 bg-sky-50 px-1 rounded">ACTIVE_PROVIDER</code> 切换提供商（ollama / codebuddy）
            </p>
          </div>

          {/* Ollama 配置 */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">🦙</span>
              <h2 className="font-semibold text-slate-700">Ollama 配置</h2>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-sm text-slate-500">Base URL</span>
                <code className="text-xs text-sky-600 bg-sky-50 px-2 py-1 rounded">{settings.ollama.baseUrl}</code>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-sm text-slate-500 flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5" /> 文本模型</span>
                <code className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded">{settings.ollama.textModel}</code>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-500 flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> 视觉模型</span>
                <code className="text-xs text-violet-600 bg-violet-50 px-2 py-1 rounded">{settings.ollama.visionModel}</code>
              </div>
            </div>
          </div>

          {/* CodeBuddy 配置 */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">🤖</span>
              <h2 className="font-semibold text-slate-700">CodeBuddy 配置</h2>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-sm text-slate-500">Base URL</span>
                <code className="text-xs text-sky-600 bg-sky-50 px-2 py-1 rounded truncate max-w-48">{settings.codebuddy.baseUrl}</code>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-sm text-slate-500 flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5" /> 文本模型</span>
                <code className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded">{settings.codebuddy.textModel}</code>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-500 flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> 视觉模型</span>
                <code className="text-xs text-violet-600 bg-violet-50 px-2 py-1 rounded">{settings.codebuddy.visionModel}</code>
              </div>
            </div>
          </div>

          {/* 环境变量说明 */}
          <div className="card border-amber-200 bg-amber-50">
            <h2 className="font-semibold text-amber-700 mb-3">⚙️ 环境变量配置</h2>
            <div className="space-y-2 text-xs font-mono">
              {[
                ['ACTIVE_PROVIDER', 'ollama | codebuddy'],
                ['OLLAMA_BASE_URL', 'http://127.0.0.1:11434'],
                ['OLLAMA_TEXT_MODEL', 'gpt-oss'],
                ['OLLAMA_VISION_MODEL', 'qwen3-vl'],
                ['CODEBUDDY_BASE_URL', 'https://codebuddy.woa.com/apigw/xcode'],
                ['CODEBUDDY_API_KEY', 'your-api-key'],
                ['CODEBUDDY_TEXT_MODEL', 'gpt-oss'],
                ['CODEBUDDY_VISION_MODEL', 'qwen3-vl'],
                ['MONGODB_URI', 'mongodb://127.0.0.1:27017/agency_agents'],
                ['JWT_SECRET', 'your-secret-key']
              ].map(([key, val]) => (
                <div key={key} className="flex items-center gap-3 py-1.5 border-b border-amber-100 last:border-0">
                  <code className="text-sky-600 w-48 flex-shrink-0">{key}</code>
                  <code className="text-slate-500">{val}</code>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
