import { Injectable, MessageEvent } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';

export interface AppRealtimeEvent {
  type:
    | 'message:created'
    | 'lead:updated'
    | 'handover:toggled'
    | 'enrollment:created'
    | 'enrollment:updated';
  data: any;
}

@Injectable()
export class EventsService {
  private readonly events$ = new Subject<MessageEvent>();

  emit(event: AppRealtimeEvent): void {
    this.events$.next({
      data: event,
    } as MessageEvent);
  }

  getStream(): Observable<MessageEvent> {
    return this.events$.asObservable();
  }
}
