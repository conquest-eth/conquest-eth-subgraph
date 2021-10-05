/* eslint-disable */
import {ZERO_ADDRESS} from './utils';
import {AllianceLink} from '../generated/AllianceRegistry/AllianceRegistry_Contract';
import {handleOwner, updateChainAndReturnTransactionID} from './shared';
import {Alliance, Owner, AllianceOwnerPair} from '../generated/schema';
import {store} from '@graphprotocol/graph-ts';

export function handleAllianceLink(event: AllianceLink): void {
  let allianceID = event.params.alliance.toHexString();
  let allianceEntity = Alliance.load(allianceID);
  if (!allianceEntity) {
    allianceEntity = new Alliance(allianceID);
    allianceEntity.save();
  }

  let owner = handleOwner(event.params.player);
  let allianceOwnerPairID = allianceID + '_' + owner.id;
  let allianceOwnerPairEntity = AllianceOwnerPair.load(allianceOwnerPairID);

  if (event.params.joining) {
    if (!allianceOwnerPairEntity) {
      allianceOwnerPairEntity = new AllianceOwnerPair(allianceOwnerPairID);
      allianceOwnerPairEntity.owner = owner.id;
      allianceOwnerPairEntity.alliance = allianceID;
      allianceOwnerPairEntity.save();
    } else {
      // ERROR
    }
  } else {
    if (allianceOwnerPairEntity) {
      store.remove('AllianceOwnerPair', allianceOwnerPairID);
    } else {
      // ERROR
    }
  }
}
