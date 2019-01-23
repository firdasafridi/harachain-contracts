const HaraTokenPrivate = artifacts.require('HaraTokenPrivate');
const DataStore = artifacts.require('DataStore');
const DataFactory = artifacts.require('DataFactory');
const DataFactoryRegistry = artifacts.require('DataFactoryRegistry');

const expectRevert = require("./helpers/expectRevert");
const expectThrow = require("./helpers/expectThrow");

contract('HaraTokenPrivate', accounts => {
  let token;
  let ds;
  let df;
  let dfr;

  const creator = accounts[0];
  const minter = accounts[1];
  const burner = accounts[2];
  const itemOwner = accounts[3];
  const buyer = accounts[4];
  const transferRecipient = accounts[5];
  const notOwner = accounts[6];
  const mintPause = accounts[7];
  const notMintPause = accounts[8];
  const buyer2 = accounts[9];

  before(async function () {
    // deploy hart contract
    token = await HaraTokenPrivate.new({ from: creator, gas: 4700000 });

    // deploy data factory contract
    df = await DataFactory.new(token.address, {from: creator, gas: 4700000});

    // deploy data factory registry
    dfr = await DataFactoryRegistry.new(df.address, {from: creator, gas: 4700000});
    
    // deploy data store contract
    ds = await DataStore.new(itemOwner, "0xB8EB1CD45DDe2BB69aE087f566629Fa82FA8fa54", "0x430dec04b9ebe807ce8fb9b0d025861c13f5e36f226c12469ff6f89fb217fa9f",
                    web3.utils.asciiToHex("markle"), token.address, dfr.address,
                    {from: itemOwner, gas: 4700000});

    await ds.setPrice(web3.utils.fromAscii("1"), 5, {from: itemOwner});
    await ds.setSale(web3.utils.fromAscii("1"), true, {from: itemOwner});

  });

  it('has a name', async function () {
    const name = await token.name();
    assert.equal(name, 'HaraToken');
  });

  it('has a symbol', async function () {
    const symbol = await token.symbol();
    assert.equal(symbol, 'HART');
  });

  it('has 18 decimals', async function () {
    const decimals = await token.decimals();
    assert.strictEqual(decimals.toNumber(), 18);
  });

  it('has HART Network ID', async function () {
    const networkId = await token.HART_NETWORK_ID();
    assert.strictEqual(networkId.toNumber(), 2);
  });

  it('assure initial supply is 0', async function () {
    const totalSupply = await token.totalSupply();
    const creatorBalance = await token.balanceOf(creator);

    assert.strictEqual(creatorBalance.toString(), totalSupply.toString());
    assert.strictEqual(totalSupply.toNumber(), 0);
  });

  describe('contract is mintable and burnable', async function () {
    before(async function () {
      // initial transfer token
      await token.mint(creator, web3.utils.toWei("500"), {from: creator});
    });

    it('transfer 10 token to burner', async function () {
      // creator balance = 10000
      // burner balance = 50
      var transferTx  = await token.transfer(burner, web3.utils.toWei("50"), { from: creator });
      const userToken = await token.balanceOf(burner);
      assert.strictEqual(userToken.toString(), (50  * Math.pow(10, 18)).toString());
      
      var transferLog = transferTx.logs[0];
      assert.strictEqual(transferLog.event, "Transfer");
      assert.strictEqual(transferLog.args.from, creator);
      assert.strictEqual(transferLog.args.to, burner);
      assert.strictEqual(transferLog.args.value.toString(), (50  * Math.pow(10, 18)).toString());
    });
  
    it('burn 20 token and mint the same amount for account[0]', async function () {
      // creator balance = 500 - 50 = 450
      // burner balance  after burn = 50 + 50 - 20 = 80
      // burner balance  after mint = 40 + 20 = 60      
      await token.transfer(burner, web3.utils.toWei("50"), { from: creator });

      var creatorBefore = await token.balanceOf(creator);
      var receipt = await token.burnToken(web3.utils.toWei("20"), "1this is tes", { from: burner });
      const logs = receipt.logs;

      const afterBurn = await token.balanceOf(burner);
      assert.strictEqual(afterBurn.toString(), (web3.utils.toWei("80")).toString());
      var creatorAfter = await token.balanceOf(creator);
      assert.strictEqual(logs.length, 6);
      assert.strictEqual(logs[5].event, "BurnLog");
      assert.strictEqual(logs[5].args.__length__, 5);
      assert.strictEqual(logs[5].args.burner.toLowerCase(), burner.toLowerCase());

      //value burn after substract with transfer fee
      assert.strictEqual(logs[5].args.value.toString(), (web3.utils.toWei("10")).toString());
      assert.strictEqual(logs[5].args.data, "1this is tes");
      
      var mintTx = await token.mintToken(logs[5].args.id.valueOf(), logs[5].args.burner, 
            logs[3].args.value.valueOf(), logs[5].args.hashDetails, 2, { from: creator });
      const afterMint = await token.balanceOf(burner);
      var mintLogs = mintTx.logs;

      assert.strictEqual(Object.keys(mintLogs).length, 3);
      assert.strictEqual(mintLogs[2].event, "MintLog");
      assert.strictEqual(mintLogs[2].args.id.toString(), logs[5].args.id.valueOf().toString());
      assert.strictEqual(logs[5].args.burner.toLowerCase(), burner.toLowerCase());
      assert.strictEqual(logs[5].args.value.toString(), (web3.utils.toWei("10")).toString());
      assert.strictEqual(logs[5].args.hashDetails, logs[5].args.hashDetails);
      assert.strictEqual(logs[5].args.data, "1this is tes");


      assert.strictEqual(afterMint.toString(), (web3.utils.toWei("90")).toString());
      assert.strictEqual((creatorAfter-creatorBefore).toString(), (web3.utils.toWei("10")));
    });
  
    it('minted by minter instead of creator', async function () {
      await token.setMinter(minter, { from: creator });
      const allowedMinter = await token.minter();
      assert.strictEqual(allowedMinter, minter);
      
      
      await token.transfer(burner, web3.utils.toWei("50"), { from: creator });
      var receiptBurn = await token.burnToken(web3.utils.toWei("20"), "1this is tes", { from: burner });
      const logsBurn = receiptBurn.logs;
      const receiptMint = await token.mintToken(logsBurn[5].args.id.valueOf(), logsBurn[5].args.burner, 
          logsBurn[3].args.value.valueOf(), logsBurn[5].args.hashDetails, 2, { from: minter });
      const logsMint = receiptMint.logs;
      assert.strictEqual(logsMint[2].args.status, true);
    });

    it('failed if burn value less than transaction fee', async function () {    
      var creatorBefore = await token.balanceOf(creator);
      var burnerBefore = await token.balanceOf(burner);
      await expectRevert(
        token.burnToken(web3.utils.toWei("5"), "1this is tes", { from: burner })
      );
      var creatorAfter = await token.balanceOf(creator);
      var burnerAfter = await token.balanceOf(burner);

      assert.strictEqual(creatorBefore.toString(), creatorAfter.toString())
      assert.strictEqual(burnerBefore.toString(), burnerAfter.toString())
    });
  });
  describe('contract have buy mechanism', async function () {
    before(async function(){
      await token.transfer(buyer, web3.utils.toWei("100"), { from: creator });
    });

    it('can buy item', async function (){
      var before = await token.balanceOf(ds.address);
      var buyItem = await token.buy(ds.address, web3.utils.fromAscii("1"), web3.utils.toWei("10"), {from: buyer});
      var receipt = await token.getReceipt(1);
      var after = await token.balanceOf(ds.address);
      
      assert.strictEqual(before.toString(), web3.utils.toWei("0"));
      assert.strictEqual(after.toString(), (web3.utils.toWei("10") * 0.8).toString());
      assert.strictEqual(receipt.buyer, buyer);
      assert.strictEqual(receipt.seller, ds.address);
      assert.strictEqual(receipt.id, web3.utils.padRight(web3.utils.fromAscii("1"), 64));
      assert.strictEqual(receipt.value.toString(), web3.utils.toWei("10"));

      var logs = buyItem.logs;
      assert.strictEqual(logs.length, 6);

    });

    it('can not buy item if already buy', async function (){
      var before = await token.balanceOf(ds.address);
      await expectRevert(
        token.buy(ds.address, web3.utils.fromAscii("1"), web3.utils.toWei("10"), {from: buyer})
      )
      var after = await token.balanceOf(ds.address);
      assert.strictEqual(before.toString(), after.toString());
    });

    it('can not buy item if price underpriced', async function (){
      var before = await token.balanceOf(buyer);
      await expectRevert(
        token.buy(ds.address, web3.utils.fromAscii("1"), 2, {from: buyer})
      );
      var after = await token.balanceOf(buyer);
      assert.strictEqual(before.toString(), after.toString());
    });

    it('can not buy item if buyer don\'t have enough token', async function (){
      var before = await token.balanceOf(buyer);
      await expectRevert(
        token.buy(ds.address, web3.utils.fromAscii("1"), web3.utils.toWei("100"), {from: buyer})
      );
      var after = await token.balanceOf(buyer);
      assert.strictEqual(before.toString(), after.toString());
    });
    
    it('can not buy item if seller address is not address', async function (){
      var before = await token.balanceOf(buyer);
      await expectThrow(
        token.buy(web3.utils.fromAscii("1"), web3.utils.fromAscii("1"), 100, {from: buyer})
      );
      var after = await token.balanceOf(buyer);
      assert.strictEqual(before.toString(), after.toString());
    });

    it('not change storage if transfer failed', async function (){
      // initial hart with transfer require value == 1 to make buy failed
      const TestToken = require('./helpers/testToken.js');
      var haratokenTestContract = new web3.eth.Contract(TestToken.abi);
      var hartTest = await haratokenTestContract.deploy({
          data: TestToken.bytecode
        }).send({
          from: creator,
          gas: 4700000
        });
      await hartTest.methods.mint(buyer2, web3.utils.toWei("500")).send({
        from: creator
      });

      var before = await hartTest.methods.balanceOf(buyer).call();
      var beforeNonce = await hartTest.methods.receiptNonce().call();
      var beforeReceipt = await hartTest.methods.getReceipt(beforeNonce).call();

      await expectRevert(
        hartTest.methods.buy(ds.address, web3.utils.fromAscii("1"), web3.utils.toWei("100")).send({from: buyer2, gas: 4700000})
      );

      var after = await hartTest.methods.balanceOf(buyer).call();
      var afterNonce = await hartTest.methods.receiptNonce().call();
      var afterReceipt = await hartTest.methods.getReceipt(afterNonce).call();

      assert.strictEqual(before.toString(), after.toString());
      assert.strictEqual(beforeNonce.toString(), afterNonce.toString());
      assert.strictEqual(beforeReceipt.toString(), afterReceipt.toString());
    });
  });

  describe('have token bridge address and burn fee', async function () {

    it('set transfer fee recipient by owner', async function () {
      var receipt = await token.setTransferRecipient(transferRecipient, { from: creator });
      var newRecipient = await token.transferFeeRecipient();
      var log = receipt.logs[0];
      assert.strictEqual(newRecipient, transferRecipient);
      assert.strictEqual(log.event, "TransferFeeRecipientChanged");
      assert.strictEqual(log.args.oldRecipient, creator);
      assert.strictEqual(log.args.newRecipient, transferRecipient);
      assert.strictEqual(log.args.modifierRecipient, creator);
    });

    it('can not set transfer fee recipient by not owner', async function (){
      var before = await token.transferFeeRecipient();
      await expectRevert(
        token.setTransferRecipient(notOwner, { from: notOwner })
      );
      var after = await token.transferFeeRecipient();
      assert.strictEqual(before.toString(), after.toString());
    });

    it('set transfer fee', async function () {
      var receipt = await token.setTransferFee(web3.utils.toWei("20"), { from: creator });
      var newFee = await token.transferFee();

      var log = receipt.logs[0];
      assert.strictEqual(newFee.toString(), (web3.utils.toWei("20")).toString());
      assert.strictEqual(log.event, "TransferFeeChanged");
      assert.strictEqual(log.args.oldFee.toString(), (web3.utils.toWei("10")).toString());
      assert.strictEqual(log.args.newFee.toString(), (web3.utils.toWei("20")).toString());
      assert.strictEqual(log.args.modifierFee.toString(), creator);
    });

    it('can not set transfer fee  by not owner', async function (){
      var before = await token.transferFee();
      await expectRevert(
        token.setTransferFee(50, { from: notOwner })
      );
      var after = await token.transferFee();
      assert.strictEqual(before.toString(), after.toString());
    });
  });

  describe('mint can be pause', async function () {

    it('set mint pause address by hart owner', async function () {
      var receipt = await token.setMintPauseAddress(mintPause, { from: creator });
      var newMintPauseAddress = await token.mintPauseAddress();
      var log = receipt.logs[0];
      assert.strictEqual(newMintPauseAddress, mintPause);
      assert.strictEqual(log.event, "MintPauseChangedLog");
      assert.strictEqual(log.args.mintPauseAddress, mintPause);
      assert.strictEqual(log.args.by, creator);
    });

    it('can not set mint pause address by not hart owner', async function (){
      await expectRevert(
        token.setMintPauseAddress(notMintPause, { from: notOwner })
      );
      var newMintPauseAddress = await token.mintPauseAddress();
      assert.strictEqual(newMintPauseAddress, mintPause);
      assert.notEqual(newMintPauseAddress, notMintPause);
    });

    it('set mint pause status by mint pause address', async function () {
      var receipt = await token.setIsMintPause(true, { from: mintPause });
      var newMintPauseStatus = await token.isMintPause();
      var log = receipt.logs[0];
      assert.strictEqual(newMintPauseStatus, true);
      assert.strictEqual(log.event, "MintPauseChangedLog");
      assert.strictEqual(log.args.status, true);
      assert.strictEqual(log.args.by, mintPause);
    });

    it('can not set mint pause status by not mint pause address', async function (){
      await expectRevert(
        token.setIsMintPause(false, { from: creator })
      );
      var newMintPauseStatus = await token.isMintPause();
      assert.strictEqual(newMintPauseStatus, true);
      assert.notEqual(newMintPauseStatus, false);
    });

    it('can not mint when mint pause status is true', async function () {
      var receiptBurn = await token.burnToken(web3.utils.toWei("25"), "1this is tes", { from: burner });
      const logsBurn = receiptBurn.logs;

      var before = await token.balanceOf(burner);
      await expectRevert(
        token.mintToken(logsBurn[5].args.id.valueOf(), logsBurn[5].args.burner, 
        logsBurn[3].args.value.valueOf(), logsBurn[5].args.hashDetails, 2, { from: minter })
      );
      var after = await token.balanceOf(burner);
      assert.strictEqual(before.toString(), after.toString());
    });
  });

});