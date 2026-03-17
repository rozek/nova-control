export declare const BaudRate = 9600;

/**** buildDirectPacket — 5-byte direct servo control packet ****/
export declare function buildDirectPacket(State: ServoState): Uint8Array;

/**** HomePosition ****/
export declare const HomePosition: Readonly<ServoState>;

/**** NovaController ****/
export declare interface NovaController {
    home(withinMS?: number): Promise<void>;
    shiftHeadTo(Angle: number, withinMS?: number): Promise<void>;
    rollHeadTo(Angle: number, withinMS?: number): Promise<void>;
    pitchHeadTo(Angle: number, withinMS?: number): Promise<void>;
    liftHeadTo(Angle: number, withinMS?: number): Promise<void>;
    rotateBodyTo(Angle: number, withinMS?: number): Promise<void>;
    moveTo(Target: ServoUpdate, withinMS?: number): Promise<void>;
    get State(): ServoState;
    set State(Update: ServoUpdate);
    sendServoState(): Promise<void>;
    destroy(): void;
}

/**** NovaOptions ****/
export declare interface NovaOptions {
    StepIntervalMs?: number;
    RampRatio?: number;
}

/**** openNova — factory ****/
export declare function openNova(PortPath: string, Rate?: number, Options?: NovaOptions): Promise<NovaController>;

/**** runScript — execute a multi-line script of movement commands ****/
export declare function runScript(Nova: NovaController, Script: string): Promise<void>;

/**** SafeRange ****/
export declare const SafeRange: Readonly<Record<ServoKey, [number, number]>>;

/*******************************************************************************
 *                                                                              *
 *                             nova-control-node                                *
 *                                                                              *
 *******************************************************************************/
/**** ServoKey ****/
export declare type ServoKey = 's1' | 's2' | 's3' | 's4' | 's5';

/**** ServoSpeed — °/ms so that the full safe range takes exactly 1 second ****/
export declare const ServoSpeed: Readonly<Record<ServoKey, number>>;

/**** ServoState ****/
export declare type ServoState = {
    [K in ServoKey]: number;
};

/**** ServoUpdate ****/
export declare type ServoUpdate = Partial<ServoState>;

export { }
