/*******************************************************************************
 *
 *                        Nova_SerialController.ino
 *
 *******************************************************************************
 *
 * Upload this sketch to the Creoqode Mini Mega (Arduino Mega-compatible) to
 * allow control of all 5 servos from nova-control-browser, nova-control-node,
 * nova-control-command, or nova-control-mcp-server over USB serial.
 *
 * This sketch extends CreoqodeNova_MouseKeyboard.ino by adding NovaServo_5.
 *
 *------------------------------------------------------------------------------
 * PROTOCOL — 5-byte direct servo control packet
 *------------------------------------------------------------------------------
 *
 *   byte 0 → NovaServo_4  (body rotation Z,     pin 38)
 *   byte 1 → NovaServo_3  (head pitch up/down,  pin 36)
 *   byte 2 → NovaServo_2  (head roll CW/CCW,    pin 34)
 *   byte 3 → NovaServo_1  (head shift fwd/back, pin 32)
 *   byte 4 → NovaServo_5  (head lift, 2nd axis, pin 40)
 *
 * Byte order for bytes 0–3 is identical to the original
 * CreoqodeNova_MouseKeyboard.ino sketch.  Byte 4 (NovaServo_5) is an
 * extension.
 *
 * This byte order matches what nova-control-browser and nova-control-node
 * produce via buildDirectPacket().
 *
 *------------------------------------------------------------------------------
 * SERVO LAYOUT
 *------------------------------------------------------------------------------
 *
 *   NovaServo_1  pin 32  — head shift forward/back     safe range: 45–135°
 *   NovaServo_2  pin 34  — head roll CW/CCW            safe range: 10–170°
 *   NovaServo_3  pin 36  — head pitch up/down          safe range: 40–150°
 *   NovaServo_4  pin 38  — body rotation (Z-axis)      safe range: 30–180°
 *   NovaServo_5  pin 40  — head lift (secondary axis)  safe range: 20–150°
 *
 * Home positions:  s1=90  s2=90  s3=110  s4=90  s5=95
 *
 * All home positions and safe ranges match the constants exported by the
 * nova-control-browser / nova-control-node packages:
 *
 *   HomePosition = { s1:90, s2:90, s3:110, s4:90, s5:95 }
 *   SafeRange    = { s1:[45,135], s2:[10,170], s3:[40,150],
 *                    s4:[30,180], s5:[20,150] }
 *
 *------------------------------------------------------------------------------
 * REQUIREMENTS
 *------------------------------------------------------------------------------
 *
 *   Arduino library: Servo  (built-in)
 *
 *******************************************************************************/

#include <Servo.h>

//------------------------------------------------------------------------------
// servo objects
//------------------------------------------------------------------------------

Servo NovaServo_1;   // head shift forward / back  (pin 32)
Servo NovaServo_2;   // head roll CW / CCW          (pin 34)
Servo NovaServo_3;   // head pitch up / down        (pin 36)
Servo NovaServo_4;   // body rotation (Z-axis)      (pin 38)
Servo NovaServo_5;   // head lift (secondary axis)  (pin 40)

//------------------------------------------------------------------------------
// home positions — must match HomePosition in nova-control-node/browser
//------------------------------------------------------------------------------

const int HOME_1 = 90;
const int HOME_2 = 90;
const int HOME_3 = 110;
const int HOME_4 = 90;
const int HOME_5 = 95;

//------------------------------------------------------------------------------
// safe ranges — must match SafeRange in nova-control-node/browser
//------------------------------------------------------------------------------

const int MIN_1 = 45,  MAX_1 = 135;   // s1: head shift
const int MIN_2 = 10,  MAX_2 = 170;   // s2: head roll
const int MIN_3 = 40,  MAX_3 = 150;   // s3: head pitch
const int MIN_4 = 30,  MAX_4 = 180;   // s4: body rotation
const int MIN_5 = 20,  MAX_5 = 150;   // s5: head lift

//------------------------------------------------------------------------------
// packet buffer
//------------------------------------------------------------------------------

const int PACKET_LEN = 5;
int       packetBuf[PACKET_LEN];
int       packetCount = 0;

//------------------------------------------------------------------------------
// helpers
//------------------------------------------------------------------------------

/**** safeWrite — constrain to [lo, hi] and write to servo ****/

int safeWrite (Servo &srv, int angle, int lo, int hi) {
  angle = constrain(angle, lo, hi);
  srv.write(angle);
  return angle;
}

//------------------------------------------------------------------------------
// setup
//------------------------------------------------------------------------------

void setup () {
  Serial.begin(9600);       // must match BaudRate in nova-control-node/browser
  Serial.setTimeout(10);

  NovaServo_1.attach(32);
  NovaServo_2.attach(34);
  NovaServo_3.attach(36);
  NovaServo_4.attach(38);
  NovaServo_5.attach(40);

  // move all servos to their home positions
  safeWrite(NovaServo_1, HOME_1, MIN_1, MAX_1);
  safeWrite(NovaServo_2, HOME_2, MIN_2, MAX_2);
  safeWrite(NovaServo_3, HOME_3, MIN_3, MAX_3);
  safeWrite(NovaServo_4, HOME_4, MIN_4, MAX_4);
  safeWrite(NovaServo_5, HOME_5, MIN_5, MAX_5);

  Serial.println("Nova ready");
}

//------------------------------------------------------------------------------
// loop — accumulate 5 bytes, then apply to servos
// byte order: [s4, s3, s2, s1, s5]
// matches buildDirectPacket() in nova-control-browser / nova-control-node
//------------------------------------------------------------------------------

void loop () {
  if (Serial.available() == 0) return;

  packetBuf[packetCount++] = Serial.read();

  if (packetCount >= PACKET_LEN) {
    safeWrite(NovaServo_4, packetBuf[0], MIN_4,  MAX_4);  // byte 0 → s4
    safeWrite(NovaServo_3, packetBuf[1], MIN_3,  MAX_3);  // byte 1 → s3
    safeWrite(NovaServo_2, packetBuf[2], MIN_2,  MAX_2);  // byte 2 → s2
    safeWrite(NovaServo_1, packetBuf[3], MIN_1,  MAX_1);  // byte 3 → s1
    safeWrite(NovaServo_5, packetBuf[4], MIN_5,  MAX_5);  // byte 4 → s5
    packetCount = 0;
  }
}
