/**
 * Cliente API para Ricoh Theta Z1
 * Documentación: https://api.ricoh/docs/theta-web-api-v2.1/
 */

export interface ThetaDeviceInfo {
  manufacturer: string;
  model: string;
  serialNumber: string;
  firmwareVersion: string;
  supportUrl: string;
  endpoints: {
    httpPort: number;
    httpUpdatesPort: number;
  };
  gps: boolean;
  gyro: boolean;
  uptime: number;
  api: string[];
  apiLevel: number[];
}

export interface ThetaState {
  fingerprint: string;
  state: {
    batteryLevel: number;
    storageUri: string;
    storageID: string;
    captureStatus: string;
    recordedTime: number;
    recordableTime: number;
    latestFileUrl: string;
    batteryState: string;
  };
}

export class ThetaAPI {
  private baseUrl = 'http://192.168.1.1';

  /**
   * Verifica si la cámara está accesible
   */
  async checkConnection(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const response = await fetch(`${this.baseUrl}/osc/info`, {
        method: 'GET',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.error('Theta connection check failed:', error);
      return false;
    }
  }

  /**
   * Obtiene información del dispositivo
   */
  async getDeviceInfo(): Promise<ThetaDeviceInfo> {
    const response = await fetch(`${this.baseUrl}/osc/info`, {
      method: 'GET',
    });
    
    if (!response.ok) {
      throw new Error('Failed to get device info');
    }
    
    return await response.json();
  }

  /**
   * Inicia una sesión con la cámara
   */
  async startSession(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/osc/commands/execute`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-XSRF-Protected': '1'
      },
      body: JSON.stringify({
        name: 'camera.startSession',
        parameters: {}
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to start session');
    }
    
    const data = await response.json();
    return data.results.sessionId;
  }

  /**
   * Cierra la sesión actual
   */
  async closeSession(sessionId: string): Promise<void> {
    await fetch(`${this.baseUrl}/osc/commands/execute`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-XSRF-Protected': '1'
      },
      body: JSON.stringify({
        name: 'camera.closeSession',
        parameters: { sessionId }
      })
    });
  }

  /**
   * Obtiene el estado actual de la cámara
   */
  async getState(): Promise<ThetaState> {
    const response = await fetch(`${this.baseUrl}/osc/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (!response.ok) {
      throw new Error('Failed to get camera state');
    }
    
    return await response.json();
  }

  /**
   * Captura una foto
   */
  async takePicture(sessionId: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/osc/commands/execute`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-XSRF-Protected': '1'
      },
      body: JSON.stringify({
        name: 'camera.takePicture',
        parameters: { sessionId }
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to take picture');
    }
    
    const data = await response.json();
    
    // Si el comando está en progreso, esperar usando polling
    if (data.state === 'inProgress') {
      return await this.pollCommandStatus(data.id);
    }
    
    return data.results.fileUrl;
  }

  /**
   * Hace polling del estado de un comando
   */
  private async pollCommandStatus(commandId: string): Promise<string> {
    const maxAttempts = 30; // 30 segundos máximo
    const pollInterval = 1000; // 1 segundo
    
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      
      const response = await fetch(`${this.baseUrl}/osc/commands/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: commandId })
      });
      
      if (!response.ok) {
        throw new Error('Failed to check command status');
      }
      
      const data = await response.json();
      
      if (data.state === 'done') {
        return data.results.fileUrl;
      }
      
      if (data.state === 'error') {
        throw new Error(data.error?.message || 'Command failed');
      }
    }
    
    throw new Error('Timeout esperando captura de foto');
  }

  /**
   * Descarga una imagen desde la cámara
   */
  async downloadImage(fileUrl: string): Promise<Blob> {
    const response = await fetch(fileUrl);
    
    if (!response.ok) {
      throw new Error('Failed to download image');
    }
    
    return await response.blob();
  }

  /**
   * Obtiene el URL del live preview (MJPEG stream)
   * Nota: Este endpoint requiere que la cámara esté en modo live view
   */
  async getLivePreview(): Promise<ReadableStream<Uint8Array>> {
    const response = await fetch(`${this.baseUrl}/osc/commands/execute`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-XSRF-Protected': '1'
      },
      body: JSON.stringify({
        name: 'camera.getLivePreview',
        parameters: {}
      })
    });
    
    if (!response.ok || !response.body) {
      throw new Error('Failed to get live preview');
    }
    
    return response.body;
  }

  /**
   * Lista los archivos en la cámara
   */
  async listFiles(maxResults: number = 10): Promise<any[]> {
    const response = await fetch(`${this.baseUrl}/osc/commands/execute`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-XSRF-Protected': '1'
      },
      body: JSON.stringify({
        name: 'camera.listFiles',
        parameters: {
          fileType: 'image',
          entryCount: maxResults,
          maxThumbSize: 0
        }
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to list files');
    }
    
    const data = await response.json();
    return data.results.entries || [];
  }
}

export const thetaAPI = new ThetaAPI();
