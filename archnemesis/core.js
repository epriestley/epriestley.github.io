(function(lib) {

  var Engine = function() {
    this.inventoryItems = [];

    this.ui = new UI()
      .setEngine(this);
    this.queue = [];
  };

  Engine.prototype = {
    queue: null,
    recipeItems: [],
    recipeResults: [],

    addItem: function(item) {
      item.setEngine(this);

      this.inventoryItems.push(item);

      if (item.getRecipe() === null) {
        this.ui.addSourceItem(item);
      }

      if (!item.getIsVirtual()) {
        this.ui.addInventoryItem(item);
      }
    },

    update: function() {
      if (this.isInventoryEmpty()) {
        this.setSinkGuidance('You have no items in your inventory.');
        this.setSinkItems([]);
        return;
      }

      var have = this.getInventoryCounts();
      var consume = {};
      var need = {};

      var edges = this.getItemEdges();
      for (var ii = 0; ii < this.inventoryItems.length; ii++) {
        var item = this.inventoryItems[ii];
        var recipe = item.getRecipe();

        if (recipe === null) {
          continue;
        }

        if (!item.getIsVirtual()) {
          continue;
        }

        this.getMissingItems(
          item.getName(),
          edges,
          have,
          consume,
          need);
      }

      var available = [];
      for (var ii = 0; ii < this.inventoryItems.length; ii++) {
        var item = this.inventoryItems[ii];
        var recipe = item.getRecipe();

        var is_critical = (item.getName() in need);

        if (recipe === null) {
          continue;
        }

        var any_missing = false;
        for (var jj = 0; jj < recipe.length; jj++) {

          if (is_critical) {
            if (consume[recipe[jj]] > 0) {
              continue;
            }
          } else {
            if (have[recipe[jj]] > 0) {
              continue;
            }
          }

          any_missing = true;
          break;
        }

        if (any_missing) {
          continue;
        }

        available.push(
          {
            item: item,
            isCritical: is_critical
          });
      }

      available.sort(function(u, v) {
        if (u.isCritical != v.isCritical) {
          return v.isCritical ? 1 : -1;
        }

        // After building critical recipes, prefer to build longer recipes
        // to reduce inventory size.

        var u_len = u.item.getRecipe().length;
        var v_len = v.item.getRecipe().length;
        if (v_len != u_len) {
          return v_len - u_len;
        }

        return 0;
      });

      var build_recipes = [];
      var prefix = [];
      var guidance = '';

      if (available.length) {
        build_recipes.push(available[0]);

        var used_items = lib.fuse(available[0].item.getRecipe());

        // We can build two recipes at the same time if they both have
        // length 2.
        var avail = 4 - build_recipes[0].item.getRecipe().length;
        for (var ii = 1; ii < available.length; ii++) {
          var r_len = available[ii].item.getRecipe().length;
          if (r_len <= avail) {
            var recipe_items = lib.fuse(available[ii].item.getRecipe());
            if (!lib.hasIntersection(used_items, recipe_items)) {
              build_recipes.push(available[ii]);
              avail -= r_len;
            }
          }
        }
      }

      var recipe_results = [];

      if (build_recipes.length) {
        var recipe_names = [];
        for (var ii = 0; ii < build_recipes.length; ii++) {
          var recipe_name = build_recipes[ii].item.getName();

          recipe_results.push(recipe_name);

          if (build_recipes[ii].isCritical) {
            recipe_name = recipe_name + ' (!)';
          }

          recipe_names.push(recipe_name);

          var recipe_items = build_recipes[ii].item.getRecipe();
          for (var jj = 0; jj < recipe_items.length; jj++) {
            prefix.push(recipe_items[jj]);
          }
        }

        recipe_names = recipe_names.join(' + ');

        if (build_recipes.length > 1) {
          guidance = 'Build Recipes: ' + recipe_names;
        } else {
          guidance = 'Build Recipe: ' + recipe_names;
        }

        if (prefix.length < 3) {
          guidance = guidance + ' + Extra Items';
        } else if (prefix.length < 4) {
          guidance = guidance + ' + Extra Item';
        }
      } else {
        prefix = [];
        guidance = 'Using up extra items.'
      }

      var recipe_items = this.getExtraItems(have, need, prefix);
      if (recipe_items) {
        this.setSinkGuidance(guidance);
        this.setSinkItems(recipe_items, recipe_results);
        return;
      }

      this.setSinkGuidance('Waiting for more items.');
      this.setSinkItems([]);
    },

    getExtraItems: function(have, need, prefix) {
      prefix = prefix || [];

      var extras = [];
      var skip = {};

      for (var ii = 0; ii < prefix.length; ii++) {
        skip[prefix[ii]] = true;
      }

      for (var ii = 0; ii < this.inventoryItems.length; ii++) {
        var item = this.inventoryItems[ii];
        var name = item.getName();

        if (skip[name]) {
          continue;
        }

        if (have[name] === 0) {
          continue;
        }

        var extra = (have[name] || 0) - (need[name] || 0);

        if (extra <= 0) {
          continue;
        }

        extras.push({
          name: item.getName(),
          n: extra
        });
      }

      extras.sort(function(u, v) {
        return (v.n - u.n);
      })

      var names = [];
      for (var ii = 0; ii < extras.length; ii++) {
        names.push(extras[ii].name);
      }

      var n = 4 - prefix.length;
      if (names.length < n) {
        return null;
      }

      return prefix.concat(names.slice(0, n));
    },

    getMissingItems: function(src, edges, have, consume, need) {
      // If we have the item, just consume it.

      if (have[src] > 0) {
        lib.incrementKey(have, src, -1);
        lib.incrementKey(consume, src);
        return;
      }

      // Mark this item as needed.

      lib.incrementKey(need, src);

      // If this is a drop-only item, we just have to wait for it to drop.
      if (!edges.hasOwnProperty(src)) {
        return;
      }

      for (var ii = 0; ii < edges[src].length; ii++) {
        var sub = edges[src][ii];
        this.getMissingItems(sub, edges, have, consume, need);
      }
    },

    getItemEdges: function() {
      var edges = {};
      for (var ii = 0; ii < this.inventoryItems.length; ii++) {
        var item = this.inventoryItems[ii];

        var recipe = item.getRecipe();
        if (!recipe) {
          continue;
        }

        edges[item.getName()] = recipe;
      }

      return edges;
    },

    isInventoryEmpty: function() {
      for (var ii = 0; ii < this.inventoryItems.length; ii++) {
        var item = this.inventoryItems[ii];

        if (item.getCount() > 0) {
          return false;
        }
      }

      return true;
    },

    getInventoryCounts: function() {
      var counts = {};

      for (var ii = 0; ii < this.inventoryItems.length; ii++) {
        var item = this.inventoryItems[ii];

        var item_count;
        if (item.getIsVirtual()) {
          item_count = 0;
        } else {
          item_count = item.getCount();
        }

        counts[item.getName()] = item_count;
      }

      return counts;
    },

    setSinkGuidance: function(guidance) {
      var ui = this.getUI();
      var node = ui.getSinkGuidanceNode();

      lib.setNodeContent(node, guidance);
    },

    setSinkItems: function(items, results) {
      var ui = this.getUI();
      var node = ui.getSinkRecipeNode();

      var map = this.getInventoryMap();

      var content = [];

      for (var ii = 0; ii < items.length; ii++) {
        var item = map[items[ii]]
        content.push(item.newRecipeNode());
      }

      lib.setNodeContent(node, content)

      this.recipeItems = items;
      this.recipeResults = results || [];

      return this;
    },

    getUI: function() {
      return this.ui;
    },

    saveInventory: function() {
      window.localStorage.setItem('inventory', this._newInventoryForStorage());

      return this;
    },

    _newInventoryForStorage: function() {
      var result = {};

      for (var ii = 0; ii < this.inventoryItems.length; ii++) {
        var item = this.inventoryItems[ii];

        if (item.getCount() > 0) {
          result[item.getName()] = item.getCount();
        }
      }

      result = window.JSON.stringify(result);

      return result;
    },

    loadInventory: function() {
      var inventory = window.localStorage.getItem('inventory');

      if (inventory) {
        inventory = window.JSON.parse(inventory);
      }

      inventory = inventory || {};

      for (var ii = 0; ii < this.inventoryItems.length; ii++) {
        var item = this.inventoryItems[ii];
        var name = item.getName();

        if (inventory.hasOwnProperty(name)) {
          item.setCount(inventory[name]);
        } else {
          item.setCount(0);
        }
      }

      return this;
    },

    saveQueue: function() {
      window.localStorage.setItem('queue', this._newQueueForStorage());

      return this;
    },

    _newQueueForStorage: function() {
      var list = [];

      for (var ii = 0; ii < this.queue.length; ii++) {
        list.push(this.queue[ii].getName());
      }

      return JSON.stringify(list);
    },

    loadQueue: function() {
      var queue = window.localStorage.getItem('queue');

      if (queue) {
        queue = window.JSON.parse(queue);
      }

      queue = queue || {};

      var map = this.getInventoryMap();

      for (var ii = 0; ii < queue.length; ii++) {
        if (map.hasOwnProperty(queue[ii])) {
          this.addQueueItem(map[queue[ii]]);
        }
      }

      return this;
    },

    getInventoryMap: function() {
      var map = {};

      for (var ii = 0; ii < this.inventoryItems.length; ii++) {
        var item = this.inventoryItems[ii];
        map[item.getName()] = item;
      }

      return map;
    },

    addQueueItem: function(item) {
      this.queue.push(item);
      this.getUI().addQueueItem(item);

      this.saveQueue();

      return this;
    },

    flushQueue: function() {
      var map = this.getInventoryMap();

      for (var ii = 0; ii < this.queue.length; ii++) {
        var item = this.queue[ii];
        item.setCount(item.getCount() + 1);
      }

      this.queue = [];

      this.getUI().clearQueue();

      this
        .saveInventory()
        .saveQueue()
        .update();

      return this;
    },

    consumeRecipe: function() {
      var map = this.getInventoryMap();

      for (var ii = 0; ii < this.recipeItems.length; ii++) {
        var item = map[this.recipeItems[ii]];
        item.setCount(item.getCount() - 1);
      }

      for (var ii = 0; ii < this.recipeResults.length; ii++) {
        var item = map[this.recipeResults[ii]];
        item.setCount(item.getCount() + 1);
      }

      this
        .saveInventory()
        .update();

      return this;
    }

  };

  var UI = function() {

  };

  UI.prototype = {
    engine: null,

    setEngine: function(engine) {
      this.engine = engine;
      return this;
    },

    getEngine: function() {
      return this.engine;
    },

    getSinkMainNode: function() {
      return lib.getNode(this, 'sink.main', this._newSinkMainNode);
    },

    _newSinkMainNode: function() {
      var attrs = {
        className: 'panel-header'
      };


      var recipe = this.getSinkRecipeNode();

      var consume_button = lib.newNode(
        'button',
        {
          className: 'action-button'
        },
        'Consume Recipe');

      consume_button.addEventListener(
        'click',
        lib.bind(this, this.onClickConsume),
        true);

      var button_1 = lib.newNode('div', {}, consume_button);

      var row_1 = [
        lib.newNode('td', {className: 'recipe-list-cell'}, recipe),
        lib.newNode('td', {className: 'recipe-buttons'}, button_1)
      ]

      var rows = [
        lib.newNode('tr', {}, row_1)
      ];

      var recipe_table = lib.newNode(
        'table',
        {className: 'recipe-table'},
        rows);

      var content = [
        lib.newNode('div', attrs, 'Next Recipe (v7)'),
        this.getSinkGuidanceNode(),
        recipe_table,
      ];

      return lib.newNode('div', {}, content);
    },

    onClickConsume: function(e) {
      e.preventDefault();
      this.getEngine().consumeRecipe();
    },

    getSinkGuidanceNode: function() {
      return lib.getNode(this, 'sink.guidance', this._newSinkGuidanceNode);
    },

    _newSinkGuidanceNode: function() {
      return lib.newNode('div');
    },

    getSinkRecipeNode: function() {
      return lib.getNode(this, 'sink.recipe', this._newSinkRecipeNode);
    },

    _newSinkRecipeNode: function() {
      return lib.newNode('div', {className: 'recipe-list'});
    },

    getSourceMainNode: function() {
      return lib.getNode(this, 'source.main', this._newSourceMainNode);
    },

    _newSourceMainNode: function() {
      var attrs = {
        className: 'panel-header'
      };

      var content = [
        lib.newNode('div', attrs, 'Add Drops to Inventory'),
        this.getSourceQueueNode(),
        this.getSourceItemsNode()
      ];

      return lib.newNode('div', {}, content);
    },

    getSourceQueueNode: function() {
      return lib.getNode(this, 'source.queue', this._newSourceQueueNode);
    },

    onClickAddRemove: function(e) {
      e.preventDefault();
      this.getEngine().flushQueue();
    },

    _newSourceQueueNode: function() {
      var add_flush = lib.newNode(
        'button',
        {className: 'action-button'},
        'Add Drops');

      add_flush.addEventListener(
        'click',
        lib.bind(this, this.onClickAddRemove),
        true);

      var button_1 = lib.newNode('div', {}, add_flush);

      var queue = this.getSourceQueueItemsNode();

      var buttons = [button_1];

      var row_1 = [
        lib.newNode('td', {className: 'queue-list-cell'}, queue),
        lib.newNode('td', {className: 'queue-buttons'}, buttons)
      ];

      var rows = [
        lib.newNode('tr', {}, row_1)
      ];

      var table = lib.newNode('table', {className: 'queue-table'}, rows);

      return lib.newNode('div', {}, table);
    },

    getSourceQueueItemsNode: function() {
      return lib.getNode(this, 'source.queue-items',
        this._newSourceQueueItemsNode);
    },

    _newSourceQueueItemsNode: function() {
      return lib.newNode('div', {className: 'queue-list'});
    },

    getInventoryMainNode: function() {
      return lib.getNode(this, 'inventory.main', this._newInventoryMainNode);
    },

    _newInventoryMainNode: function() {
      var attrs = {
        className: 'panel-header'
      };

      var content = [
        lib.newNode('div', attrs, 'Current Inventory'),
        this.getInventoryItemsNode()
      ];

      return lib.newNode('div', {}, content);
    },

    getInventoryItemsNode: function() {
      return lib.getNode(this, 'inventory.items', this._newInventoryItemsNode);
    },

    _newInventoryItemsNode: function() {
      return lib.newNode('div');
    },

    addInventoryItem: function(item) {
      var node = item.getInventoryItemNode();
      this.getInventoryItemsNode().appendChild(node);
      return this;
    },

    addSourceItem: function(item) {
      var node = item.getSourceItemNode();
      this.getSourceItemsNode().appendChild(node);
      return this;
    },

    getSourceItemsNode: function() {
      return lib.getNode(this, 'source.items', this._newSourceItemsNode);
    },

    _newSourceItemsNode: function() {
      return lib.newNode('div');
    },

    addQueueItem: function(item) {
      var node = this.getSourceQueueItemsNode();

      node.appendChild(item.newQueueNode());

      return node;
    },

    clearQueue: function() {
      var node = this.getSourceQueueItemsNode();

      lib.setNodeContent(node, '');

      return node;
    }


  };

  var Item = function(data) {
    this.nodes = {};

    this.setName(data.name);
    this.setRecipe(data.recipe);
    this.setIsVirtual(data.virtual || false);
    this.setImage(data.image);
  };

  Item.prototype = {
    name: null,
    count: 0,
    engine: null,
    recipe: null,
    isVirtual: null,
    image: null,

    newRecipeNode: function() {
      var icon_node = this._newIconNode();
      var name_node = lib.newNode('div', {class: 'item-name'}, this.getName());

      var row_1 = [
        lib.newNode('td', {className: 'cell-icon'}, icon_node),
        lib.newNode('td', {className: 'cell-name'}, name_node)
      ];

      var rows = [
        lib.newNode('tr', {}, row_1)
      ];

      var content = lib.newNode('table', {}, rows);

      return lib.newNode('div', {className: 'item-ref'}, content);
    },

    getImage: function() {
      return this.image;
    },

    setImage: function(image) {
      this.image = image;

      var nodes = [
        this.getSourceIconNode(),
        this.getInventoryIconNode()
      ];

      for (var ii = 0; ii < nodes.length; ii++) {
        var node = nodes[ii];
        if (image) {
          node.style.backgroundImage = 'url("rsrc/' + this.getImage() + '")';
        } else {
          node.style.backgroundImage = '';
        }
      }

      return this;
    },

    getRecipe: function() {
      return this.recipe;
    },

    setRecipe: function(recipe) {
      this.recipe = recipe;
    },

    setEngine: function(engine) {
      this.engine = engine;
      return this;
    },

    getEngine: function() {
      return this.engine;
    },

    setIsVirtual: function(virtual) {
      this.isVirtual = virtual;
      return this;
    },

    getIsVirtual: function() {
      return this.isVirtual;
    },

    setName: function(name) {
      this.name = name;
      lib.setNodeContent(this.getInventoryNameNode(), name);
      lib.setNodeContent(this.getSourceNameNode(), name);
    },

    getName: function() {
      return this.name;
    },

    setCount: function(count) {
      this.count = count;
      lib.setNodeContent(this.getInventoryCountNode(), count);

      var node = this.getInventoryItemNode();
      lib.setClass(node, 'no-items', (count === 0));

      return this;
    },

    getCount: function() {
      return this.count;
    },

    getSourceItemNode: function() {
      return lib.getNode(this, 'source.item', this._newSourceItemNode);
    },

    _newSourceItemNode: function() {
      var attrs = {
        className: 'item-source item-ref'
      };

      var icon_node = this.getSourceIconNode();
      var name_node = this.getSourceNameNode();

      var row_1 = [
        lib.newNode('td', {className: 'cell-icon'}, icon_node),
        lib.newNode('td', {className: 'cell-name'}, name_node)
      ];

      var rows = [
        lib.newNode('tr', {}, row_1)
      ];

      var content = lib.newNode('table', {}, rows);

      var node = lib.newNode('div', attrs, content);

      node.addEventListener(
        'click',
        lib.bind(this, this.addQueueItem),
        true);

      return node;
    },

    addQueueItem: function(e) {
      e.preventDefault();

      this.getEngine()
        .addQueueItem(this);
    },

    getSourceIconNode: function() {
      return lib.getNode(this, 'source.icon', this._newIconNode);
    },

    _newIconNode: function() {
      var attrs = {
        className: 'item-icon'
      };

      var node = lib.newNode('div', attrs);

      var image = this.getImage();
      if (image) {
        node.style.backgroundImage = 'url("rsrc/' + image + '")';
      }

      return node;
    },

    getSourceNameNode: function() {
      return lib.getNode(this, 'source.name', this._newNameNode);
    },

    getInventoryItemNode: function() {
      return lib.getNode(this, 'inventory.item', this._newInventoryItemNode);
    },

    _newInventoryItemNode: function() {
      var icon_node = this.getInventoryIconNode();
      var name_node = this.getInventoryNameNode();

      var dec_node = this.getInventoryDecrementNode();
      var count_node = this.getInventoryCountNode();
      var inc_node = this.getInventoryIncrementNode();

      var row_1 = [
        lib.newNode('td', {className: 'cell-icon', rowSpan: 2}, icon_node),
        lib.newNode('td', {className: 'cell-name', colSpan: 3}, name_node)
      ];

      var row_2 = [
        lib.newNode('td', {className: 'cell-incdec'}, dec_node),
        lib.newNode('td', {className: 'cell-count'}, count_node),
        lib.newNode('td', {className: 'cell-incdec'}, inc_node)
      ];

      var rows = [
        lib.newNode('tr', {}, row_1),
        lib.newNode('tr', {}, row_2),
      ];

      var content = lib.newNode('table', {}, rows);

      var attrs = {
        className: 'item-inventory item-ref'
      };

      var node = lib.newNode('div', attrs, content);

      return node;
    },

    getInventoryDecrementNode: function() {
      return lib.getNode(this, 'inventory.decrement', this._newDecrementNode);

    },

    getInventoryIncrementNode: function() {
      return lib.getNode(this, 'inventory.increment', this._newIncrementNode);
    },

    _newDecrementNode: function() {
      var button = lib.newNode('button', {}, '-');

      var callback = lib.bind(this, this._onInventoryButton, -1);
      button.addEventListener('click', callback, true);

      return lib.newNode('div', {className: 'inventory-incdec'}, button);
    },

    _newIncrementNode: function() {
      var button = lib.newNode('button', {}, '+');

      var callback = lib.bind(this, this._onInventoryButton, 1);
      button.addEventListener('click', callback, true);

      return lib.newNode('div', {className: 'inventory-incdec'}, button);
    },

    _onInventoryButton: function(n, e) {
      e.preventDefault();

      var count = this.getCount();
      count = count + n;
      if (count < 0) {
        count = 0;
      }

      this.setCount(count);

      this.getEngine()
        .saveInventory()
        .update();
    },

    getInventoryIconNode: function() {
      return lib.getNode(this, 'inventory.icon', this._newIconNode);
    },

    getInventoryNameNode: function() {
      return lib.getNode(this, 'inventory.name', this._newNameNode);
    },

    _newNameNode: function() {
      return lib.newNode('div', {className: 'item-name'});
    },

    getInventoryCountNode: function() {
      return lib.getNode(this, 'inventory.count', this._newInventoryCountNode);
    },

    _newInventoryCountNode: function() {
      return lib.newNode('div');
    },

    newQueueNode: function() {
      return lib.newNode('div', {className: 'queue-item'}, this._newIconNode());
    }

  };

  var item_data = [
    {
      name:  "Toxic",
      image: "toxic.png"
    },
    {
      name: "Chaosweaver",
      image: "chaosweaver.png"
    },
    {
      name: "Frostweaver",
      image: "frostweaver.png"
    },
    {
      name: "Permafrost",
      image: "permafrost.png"
    },
    {
      name: "Hasted",
      image: "hasted.png"
    },
    {
      name: "Deadeye",
      image: "deadeye.png",
    },
    {
      name: "Bombardier",
      image: "bombardier.png"
    },
    {
      name: "Flameweaver",
      image: "flameweaver.png"
    },
    {
      name: "Incendiary",
      image: "incendiary.png"
    },
    {
      name: "Arcane Buffer",
      image: "arcane-buffer.png"
    },
    {
      name: "Echoist",
      image: "echoist.png"
    },
    {
      name: "Stormweaver",
      image: "stormweaver.png"
    },
    {
      name: "Dynamo",
      image: "dynamo.png"
    },
    {
      name: "Bonebreaker",
      image: "bonebreaker.png"
    },
    {
      name: "Bloodletter",
      image: "bloodletter.png"
    },
    {
      name: "Steel-infused",
      image: "steel-infused.png"
    },
    {
      name: "Gargantuan",
      image: "gargantuan.png"
    },
    {
      name: "Berserker",
      image: "berserker.png"
    },
    {
      name: "Sentinel",
      image: "sentinel.png"
    },
    {
      name: "Juggernaut",
      image: "juggernaut.png"
    },
    {
      name: "Vampiric",
      image: "vampiric.png"
    },
    {
      name: "Overcharged",
      image: "overcharged.png"
    },
    {
      name: "Soul Conduit",
      image: "soul-conduit.png"
    },
    {
      name: "Malediction",
      image: "malediction.png"
    },
    {
      name: "Consecrator",
      image: "consecrator.png"
    },
    {
      name: "Frenzied",
      image: "frenzied.png"
    },
    {
      name: "Opulent",
      image: "opulent.png"
    },
    {
      name: "Corrupter",
      recipe: ["Bloodletter", "Chaosweaver"],
      image: "corrupter.png"

    },
    {
      name: "Necromancer",
      recipe: ["Bombardier", "Overcharged"],
      image: "necromancer.png"

    },
    {
      name: "Hexer",
      recipe: ["Chaosweaver", "Echoist"],
      image: "hexer.png"
    },
    {
      name: "Mana Siphoner",
      recipe: ["Consecrator", "Dynamo"],
      image: "mana-siphoner.png"
    },
    {
      name: "Assassin",
      recipe: ["Deadeye", "Vampiric"],
      image: "assassin.png"
    },
    {
      name: "Heralding Minions",
      recipe: ["Dynamo", "Arcane Buffer"],
      image: "heralding-minions.png"
    },
    {
      name: "Mirror Image",
      recipe: ["Echoist", "Soul Conduit"],
      image: "mirror-image.png"
    },
    {
      name: "Flame Strider",
      recipe: ["Flameweaver", "Hasted"],
      image: "flame-strider.png"
    },
    {
      name: "Executioner",
      recipe: ["Frenzied", "Berserker"],
      image: "executioner.png"
    },
    {
      name: "Frost Strider",
      recipe: ["Frostweaver", "Hasted"],
      image: "frost-strider.png"
    },
    {
      name: "Rejuvenating",
      recipe: ["Gargantuan", "Vampiric"],
      image: "rejuvenating.png"
    },
    {
      name: "Magma Barrier",
      recipe: ["Incendiary", "Bonebreaker"],
      image: "magma-barrier.png"
    },
    {
      name: "Drought Bringer",
      recipe: ["Malediction", "Deadeye"],
      image: "drought-bringer.png"
    },
    {
      name: "Ice Prison",
      recipe: ["Permafrost", "Sentinel"],
      image: "ice-prison.png"
    },
    {
      name: "Storm Strider",
      recipe: ["Stormweaver", "Hasted"],
      image: "storm-strider.png"
    },
    {
      name: "Entangler",
      recipe: ["Toxic", "Bloodletter"],
      image: "entangler.png"
    },
    {
      name: "Corpse Detonator",
      recipe: ["Necromancer", "Incendiary"],
      image: "corpse-detonator.png"
    },
    {
      name: "Evocationist",
      recipe: ["Flameweaver", "Frostweaver", "Stormweaver"],
      image: "evocationist.png"
    },
    {
      name: "Invulnerable",
      recipe: ["Sentinel", "Juggernaut", "Consecrator"],
      image: "invulnerable.png"
    },
    {
      name: "Soul Eater",
      recipe: ["Necromancer", "Gargantuan", "Soul Conduit"],
      image: "soul-eater.png"
    },
    {
      name: "Empowering Minions",
      recipe: ["Necromancer", "Executioner", "Gargantuan"],
      image: "empowering-minions.png"
    },
    {
      name: "Abberath-touched",
      recipe: ["Flame Strider", "Rejuvenating", "Frenzied"],
      image: "abberath-touched.png"
    },
    {
      name: "Tukohama-touched",
      recipe: ["Magma Barrier", "Executioner", "Bonebreaker"],
      image: "tukohama-touched.png"
    },
    {
      name: "Treant Horde",
      recipe: ["Toxic", "Sentinel", "Steel-infused"],
      image: "treant-horde.png"
    },
    {
      name: "Crystal-skinned",
      recipe: ["Rejuvenating", "Permafrost", "Berserker"],
      image: "crystal-skinned.png"
    },
    {
      name: "Temporal Bubble",
      recipe: ["Hexer", "Arcane Buffer", "Juggernaut"],
      image: "temporal-bubble.png"
    },
    {
      name: "Trickster",
      recipe: ["Assassin", "Echoist", "Overcharged"],
      image: "trickster.png"
    },
    {
      name: "Effigy",
      recipe: ["Hexer", "Corrupter", "Malediction"],
      image: "effigy.png"
    },
    {
      name: "Brine King-touched",
      recipe: ["Ice Prison", "Storm Strider", "Heralding Minions"],
      image: "brine-king-touched.png"
    },
    {
      name: "Lunaris-touched",
      recipe: ["Invulnerable", "Empowering Minions", "Frost Strider"],
      image: "lunaris-touched.png"
    },
    {
      name: "Solaris-touched",
      recipe: ["Invulnerable", "Empowering Minions", "Magma Barrier"],
      image: "solaris-touched.png"
    },
    {
      name: "Empowered Elements",
      recipe: ["Evocationist", "Steel-infused", "Chaosweaver"],
      image: "empowered-elements.png"
    },
    {
      name: "Arakaali-touched",
      recipe: ["Corpse Detonator", "Entangler", "Assassin"],
      image: "arakaali-touched.png"
    },
    {
      name: "Shakari-touched",
      recipe: ["Soul Eater", "Drought Bringer", "Entangler"],
      image: "shakari-touched.png"
    },
    {
      name: "Kitava-touched",
      recipe: [
        "Tukohama-touched",
        "Abberath-touched",
        "Corpse Detonator",
        "Corrupter"
      ],
      image: "kitava-touched.png"
    },
    {
      name: "Innocence-touched",
      recipe: [
        "Lunaris-touched",
        "Solaris-touched",
        "Mirror Image",
        "Mana Siphoner"
      ],
      image: "innocence-touched.png"
    },
    {
      name: "Currency",
      recipe: [
        "Innocence-touched",
        "Brine King-touched",
        "Abberath-touched",
        "Tukohama-touched"
      ],
      virtual: true,
      image: ""
    }
  ];

  item_data.sort(function(u, v) {
    return u.name.localeCompare(v.name);
  })

  var on_load = function() {
    var engine = new Engine();

    for (var ii = 0; ii < item_data.length; ii++) {
      var data = item_data[ii];

      data.recipe = data.recipe || null;

      var item = new Item(data);
      engine.addItem(item);
    }

    var ui = engine.ui;

    lib.setNodeContent(
      document.body,
      [
        ui.getSinkMainNode(),
        ui.getSourceMainNode(),
        ui.getInventoryMainNode(),
      ]
    );

    engine
      .loadInventory()
      .loadQueue()
      .update();
  };

  document.addEventListener('DOMContentLoaded', on_load, true);
})({

  bind: function(context, func, more) {
    var argv = [].slice.apply(arguments, [2]);

    if (func.bind) {
      return func.bind.apply(func, [context].concat(argv));
    }

    return function() {
      return func.apply(context || window, argv.concat(arguments));
    };
  },

  copy: function(dst, src) {
    for (var k in src) {
      if (src.hasOwnProperty(k)) {
        dst[k] = src[k];
      }
    }

    return dst;
  },

  incrementKey: function(map, key, value) {
    if (!map.hasOwnProperty(key)) {
      map[key] = 0;
    }

    map[key] += value || 1;

    return map;
  },

  getNode: function(object, key, generator) {
    if (!object._nodes) {
      object._nodes = {};
    }

    if (!object._nodes.hasOwnProperty(key)) {
      object._nodes[key] = generator.apply(object);
    }

    return object._nodes[key];
  },

  newNode: function(type, attrs, content) {
    var node = document.createElement(type);

    attrs = attrs || {};

    for (var k in attrs) {
      if (!attrs.hasOwnProperty(k)) {
        continue;
      }

      if (attrs[k] === null) {
        continue;
      }

      node[k] = attrs[k];
    }

    content = content || null;
    if (content !== null) {
      this.setNodeContent(node, content);
    }

    return node;
  },

  setNodeContent: function(node, content) {
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
    this.appendContent(node, content);
  },

  appendContent: function(node, content) {
    if (Array.isArray(content)) {
      for (var ii = 0; ii < content.length; ii++) {
        this.appendContent(node, content[ii]);
      }
      return;
    }

    var type = typeof content;
    if (type == 'string' || type == 'number') {
      content = document.createTextNode(content);
    }

    node.appendChild(content);
  },

  setClass: function(node, css_class, active) {
    if (active === undefined) {
      active = true;
    }

    var old_classes = (node.className || '').split(' ');
    var map_classes = {};
    var new_classes = [];

    if (active) {
      old_classes.push(css_class);
    }

    for (var ii = 0; ii < old_classes.length; ii++) {
      var old_class = old_classes[ii];

      if (!active) {
        if (old_class === css_class) {
          continue;
        }
      }

      if (map_classes.hasOwnProperty(old_class)) {
        continue;
      }

      map_classes[old_class] = true;
      new_classes.push(old_class);
    }

    node.className = new_classes.join(' ');

    return node;
  },

  fuse: function(list) {
    var map = {};

    for (var ii = 0; ii < list.length; ii++) {
      map[list[ii]] = list[ii];
    }

    return map;
  },

  hasIntersection: function(map_u, map_v) {
    for (var k in map_u) {
      if (!k in map_v) {
        continue;
      }

      if (map_u.hasOwnProperty(k) && map_v.hasOwnProperty(k)) {
        return true;
      }
    }

    return false;
  }

});

