import 'dotenv/config';
import {TheGraph} from '../utils/thegraph';

const theGraph = new TheGraph(`https://api.thegraph.com/subgraphs/name/${process.env.SUBGRAPH_NAME}`);

// query($blockNumber: Int! $first: Int! $lastId: ID! $id: ID!) {
const queryString = `
query($first: Int! $lastId: ID!) {
    owners(first: $first where: {
      totalStaked_gt: 0
      id_gt: $lastId
    }) {
      id
      introducer { id }
      playTokenGiven
    }
}
`;

async function main() {
  const players: {
    id: string;
  }[] = await theGraph.query(queryString, {field: 'owners'});
  console.log(JSON.stringify(players, null, 2));
  console.log({numPlayers: players.length});
}

main();
