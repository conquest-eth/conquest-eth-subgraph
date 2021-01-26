import {
  store,
  Bytes,
  ByteArray,
  // Address,
  BigInt,
  // BigDecimal,
} from '@graphprotocol/graph-ts';
import {
  // OuterSpaceContract,
  PlanetStake,
  FleetSent,
  FleetArrived,
  Attack,
  StakeToWithdraw,
  PlanetExit,
} from '../generated/OuterSpace/OuterSpaceContract';
import {
  // NamedEntity,
  AcquiredPlanet,
  AttackResult,
  Fleet,
  ReinforcementArrived,
} from '../generated/schema';
import {log} from '@graphprotocol/graph-ts';

const ZERO_ADDRESS: Bytes = Bytes.fromHexString(
  '0x0000000000000000000000000000000000000000'
) as Bytes;
const ZERO = BigInt.fromI32(0);

function flipHex(str: string): string {
  let newStr = '0x';
  for (let i = 2; i < str.length; i++) {
    let char = str.charAt(i);
    if (char == '0') {
      char = 'f';
    } else if (char == '1') {
      char = 'e';
    } else if (char == '2') {
      char = 'd';
    } else if (char == '3') {
      char = 'c';
    } else if (char == '4') {
      char = 'b';
    } else if (char == '5') {
      char = 'a';
    } else if (char == '6') {
      char = '9';
    } else if (char == '7') {
      char = '8';
    } else if (char == '8') {
      char = '7';
    } else if (char == '9') {
      char = '6';
    } else if (char == 'a' || char == 'A') {
      char = '5';
    } else if (char == 'b' || char == 'B') {
      char = '4';
    } else if (char == 'c' || char == 'C') {
      char = '3';
    } else if (char == 'd' || char == 'D') {
      char = '2';
    } else if (char == 'e' || char == 'E') {
      char = '1';
    } else if (char == 'f' || char == 'F') {
      char = '0';
    }
    newStr += char;
  }
  return newStr;
}

function c2(str: string): BigInt {
  return BigInt.fromSignedBytes(
    ByteArray.fromHexString(str).reverse() as Bytes
  );

  // if (str.charCodeAt(2) > 55) {
  // > 7 (0111)
  // str = flipHex(str);
  // return BigInt.fromUnsignedBytes(ByteArray.fromHexString(str) as Bytes);
  // .plus(
  //   BigInt.fromI32(1)
  // )
  // .neg();
  // } else {
  //   return BigInt.fromUnsignedBytes(ByteArray.fromHexString(str) as Bytes);
  // }
}

export function handlePlanetStake(event: PlanetStake): void {
  const id = '0x' + event.params.location.toHex().slice(2).padStart(64, '0');
  log.error('id: {}', [id]);
  let entity = AcquiredPlanet.load(id);
  if (!entity) {
    entity = new AcquiredPlanet(id);
  }
  entity.owner = event.params.acquirer;
  // entity.location = event.params.location;
  entity.numSpaceships = event.params.numSpaceships;
  entity.lastUpdated = event.block.timestamp;
  entity.exitTime = ZERO;

  const yString = id.slice(0, 34);
  const xString = '0x' + id.slice(34);

  const x = c2(xString);
  const absX = x.abs();
  const signX = x.lt(BigInt.fromI32(-32))
    ? BigInt.fromI32(-1)
    : BigInt.fromI32(1);

  log.error('(x,y): ({},{})', [xString, yString]);

  const centerZoneX = absX.plus(BigInt.fromI32(32)).div(BigInt.fromI32(64));

  const centerZoneXString = signX.equals(BigInt.fromI32(1))
    ? centerZoneX.toHex().slice(2).padStart(32, '0')
    : flipHex(
        '0x' +
          centerZoneX
            .minus(BigInt.fromI32(1))
            .toHexString()
            .slice(2)
            .padStart(32, '0')
      ).slice(2);

  const y = c2(yString);
  const absY = y.abs();
  const signY = y.lt(BigInt.fromI32(-32))
    ? BigInt.fromI32(-1)
    : BigInt.fromI32(1);

  const centerZoneY = absY.plus(BigInt.fromI32(32)).div(BigInt.fromI32(64));

  const centerZoneYString = signY.equals(BigInt.fromI32(1))
    ? centerZoneY.toHex().slice(2).padStart(32, '0')
    : flipHex(
        '0x' +
          centerZoneY
            .minus(BigInt.fromI32(1))
            .toHex()
            .slice(2)
            .padStart(32, '0')
      ).slice(2);

  entity.zone = '0x' + centerZoneYString + centerZoneXString;

  entity.x = x;
  entity.y = y;
  entity.zoneX = signX.equals(BigInt.fromI32(1))
    ? centerZoneX
    : centerZoneX.neg();
  entity.zoneY = signY.equals(BigInt.fromI32(1))
    ? centerZoneY
    : centerZoneY.neg();

  log.error('zone: {}', [entity.zone]);

  // entity.zone =
  //   BigInt.fromI32(-2).toHex() +
  //   '|||' +
  //   BigInt.fromI32(-1).toHex() +
  //   '|||' +
  //   '0x' +
  //   centerZoneX.toHexString().slice(2).padStart(32, '0') +
  //   centerZoneY.toHexString().slice(2).padStart(32, '0');
  entity.save();
}

export function handleFleetSent(event: FleetSent): void {
  const fleetId = event.params.fleet.toString();

  let fleetEntity = Fleet.load(fleetId);
  if (!fleetEntity) {
    fleetEntity = new Fleet(fleetId);
  }
  fleetEntity.owner = event.params.sender;
  fleetEntity.launchTime = event.block.timestamp;
  fleetEntity.from = event.params.from;
  fleetEntity.quantity = event.params.quantity;
  fleetEntity.save();

  const planetId = '0x' + event.params.from.toHex().slice(2).padStart(64, '0');

  let planetEntity = AcquiredPlanet.load(planetId);
  if (!planetEntity) {
    planetEntity = new AcquiredPlanet(planetId);
    log.error('planet never acquired: {}', [planetId]); // this should never happen, no fleet can come from an planet that was not acquired
  }
  planetEntity.numSpaceships = event.params.newNumSpaceships;
  planetEntity.lastUpdated = event.block.timestamp;
  planetEntity.save();
}

export function handleFleetArrived(event: FleetArrived): void {
  const fleetId = event.params.fleet.toString();
  let reinforcementEntity = ReinforcementArrived.load(fleetId);
  if (!reinforcementEntity) {
    reinforcementEntity = new ReinforcementArrived(fleetId);
  }
  const fleetEntity = Fleet.load(fleetId);
  reinforcementEntity.numSpaceships = fleetEntity.quantity;
  reinforcementEntity.timestamp = event.block.timestamp;
  reinforcementEntity.save();

  const planetId =
    '0x' + event.params.location.toHex().slice(2).padStart(64, '0');
  let planetEntity = AcquiredPlanet.load(planetId);
  if (!planetEntity) {
    planetEntity = new AcquiredPlanet(planetId);
    log.error('planet never acquired: {}', [planetId]); // this should never happen, onwer can only be set in stake or attack
  }
  planetEntity.numSpaceships = event.params.newNumspaceships;
  planetEntity.lastUpdated = event.block.timestamp;
  planetEntity.save();

  store.remove('Fleet', fleetId);
}

export function handleAttack(event: Attack): void {
  const fleetId = event.params.fleet.toString();
  let attackResultEntity = AttackResult.load(fleetId);
  if (!attackResultEntity) {
    attackResultEntity = new AttackResult(fleetId);
  }
  attackResultEntity.attackerLoss = event.params.fleetLoss;
  attackResultEntity.defenderLoss = event.params.toLoss;
  attackResultEntity.capture = event.params.won;
  attackResultEntity.timestamp = event.block.timestamp;
  attackResultEntity.save();

  const fleetEntity = Fleet.load(fleetId);
  const planetId =
    '0x' + event.params.location.toHex().slice(2).padStart(64, '0');

  let planetEntity = AcquiredPlanet.load(planetId);
  if (!planetEntity) {
    // TODO handle natives successful
    planetEntity = new AcquiredPlanet(planetId);
    planetEntity.owner = ZERO_ADDRESS;
  }

  if (event.params.won) {
    planetEntity.owner = fleetEntity.owner;
    planetEntity.exitTime = ZERO;
  }

  planetEntity.numSpaceships = event.params.newNumspaceships;
  planetEntity.lastUpdated = event.block.timestamp;

  planetEntity.save();

  store.remove('Fleet', fleetId);
}

export function handleExit(event: PlanetExit): void {
  const planetId =
    '0x' + event.params.location.toHex().slice(2).padStart(64, '0');

  let planetEntity = AcquiredPlanet.load(planetId);
  if (!planetEntity) {
    planetEntity = new AcquiredPlanet(planetId);
    log.error('planet never acquired: {}', [planetId]); // this should never happen, exit can only happen when acquired
  }
  planetEntity.exitTime = event.block.timestamp;
  planetEntity.save();
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function handleStakeToWithdraw(event: StakeToWithdraw): void {
  // TODO Stake
}
