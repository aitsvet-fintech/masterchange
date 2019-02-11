<div id="editor">pragma solidity ^0.4.21;

contract Token {

  address public owner;

  function Token() public {
    owner = msg.sender;
  }

//} /*
  mapping(address => uint) public balance;

  function produce(uint amount) public {
    require (msg.sender == owner);
    balance[owner] += amount;
  }

  function transfer(uint amount, address to) public {
    require (balance[msg.sender] >= amount);
    balance[msg.sender] -= amount;
    balance[to] += amount;
  }

//} /*
  mapping(address => mapping(address => uint)) public proposed;

  function propose(uint amount, address to) public {
    require (balance[msg.sender] >= amount);
    balance[msg.sender] -= amount;
    proposed[msg.sender][to] += amount;
  }

  function cancel(address to) public {
    balance[msg.sender] += proposed[msg.sender][to];
    proposed[msg.sender][to] = 0;
  }

  function receive(address from) public {
    balance[msg.sender] += proposed[from][msg.sender];
    proposed[from][msg.sender] = 0;
  }

//} /*
}

contract Exchange {

  mapping(address =>     // from token
    mapping(uint =>      // proposed amount
      mapping(address => // to token
        mapping(uint =>  // desired amount
          address[])))) public bidders;

  function change(Token from, Token to, uint desired, bool canWait) public {

    uint proposed = from.proposed(msg.sender, this);
    require (proposed > 0);

    uint length = bidders[to][desired][from][proposed].length;
    if (length == 0) {

        require (canWait);
        from.receive(msg.sender);
        bidders[from][proposed][to][desired].push(msg.sender);

    } else {

        from.receive(msg.sender);
        address waiter = bidders[to][desired][from][proposed][0];

        if (length > 1)
            bidders[to][desired][from][proposed][0] =
                bidders[to][desired][from][proposed][length - 1];
        bidders[to][desired][from][proposed].length--;

        from.transfer(proposed, waiter);
        to.transfer(desired, msg.sender);
    }
  }

  function cancel(Token from, uint proposed,
                  Token to, uint desired, uint bidIndex) public {

    require (bidders[from][proposed][to][desired][bidIndex] == msg.sender);
    uint length = bidders[from][proposed][to][desired].length;

    if (length > 1)
        bidders[from][proposed][to][desired][bidIndex] =
            bidders[from][proposed][to][desired][length - 1];
    bidders[from][proposed][to][desired].length--;

    from.transfer(proposed, msg.sender);
  }
} /* */
</div>
