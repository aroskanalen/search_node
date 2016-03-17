/**
 * @file
 * API tests.
 */

var supertest = require("supertest");
var should = require("should");

var server = supertest.agent("http://localhost:3010");

var auth = {
  "apikey": "795359dd2c81fa41af67faa2f9adbd32"
};
var token;

var index = 'e374e212db3409573917dd6e968c83ba';

/**
 * API authentication tests.
 */
describe('API basic test', function() {

  it('Test /api exists (401)', function(done) {
    server.get("/api")
      .expect(401)
      .end(function(err, res) {

        res.status.should.equal(401);

        done();
      });
  });

  it('Authentication', function (done) {
    server.post('/authenticate')
      .send(auth)
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {

        res.status.should.equal(200);

        should.exist(res.body.token);
        token = res.body.token;

        done();
      });
  });


  it('Test /api after login (200)', function(done) {
    server.get("/api")
      .set('Authorization', 'Bearer ' + token)
      .expect(200)
      .end(function(err, res) {

        res.status.should.equal(200);

        should.not.exist(err);

        done();
      });
  });

});

/**
 * Data index API tests.
 */
describe('Index API', function() {
  var mapping = {
    "name": "Test",
    "fields": [
      {
        "type": "string",
        "country": "DK",
        "language": "da",
        "default_analyzer": "string_index",
        "sort": true,
        "indexable": true,
        "raw": false,
        "geopoint": false,
        "field": "Title",
        "default_indexer": "analyzed"
      },
      {
        "type": "string",
        "country": "DK",
        "language": "da",
        "default_analyzer": "string_index",
        "default_indexer": "analyzed",
        "sort": false,
        "raw": false,
        "field": "content",
        "indexable": true
      },
      {
        "type": "string",
        "country": "DK",
        "language": "da",
        "default_analyzer": "string_index",
        "default_indexer": "not_analyzed",
        "sort": false,
        "raw": true,
        "field": "field_level",
        "indexable": true
      },
      {
        "type": "geo_point",
        "country": "DK",
        "language": "da",
        "default_analyzer": "string_index",
        "default_indexer": "analysed",
        "sort": false,
        "indexable": false,
        "raw": false,
        "geopoint": true,
        "field": "location"
      }
    ],
    "dates": [
      "created"
    ],
    "tag": "private"
  };

  var content = [{
    "content": "<p>Brevitas dignissim nimis pecus qui tation turpis validus. Commodo consequat damnum duis eligo eum neo patria. Abigo enim facilisi neque roto valetudo. Accumsan decet nisl pala refero tego. Augue dignissim hendrerit nostrud.</p>",
    "field_level": [ "First", "Last" ],
    "title":"Ad Dolor Laoreet Letalis Pecus",
    "created": "1458044708",
    "location": {
      "lat": "56.344961",
      "lon": "9.667969"
    }
  }, {
    "content": "<p>Quae vero auctorem tractata ab fiducia dicuntur.</p>",
    "field_level": [ "First" ],
    "title":"Ad Dolor",
    "created": "1458045708",
    "location": {
      "lat": "56.354961",
      "lon": "9.687969"
    }
  }];

  it('Create new mapping', function (done) {
    server.post('/api/' + index + '/create')
      .set('Authorization', 'Bearer ' + token)
      .send(mapping)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        res.status.should.equal(200);

        done();
      });
  });

  it('Activate new index', function (done) {
    server.get('/api/' + index + '/activate')
      .set('Authorization', 'Bearer ' + token)
      .expect('Content-Type', /json/)
      .end(function (err, res) {

        res.status.should.equal(200);

        done();
      });
  });

  it('Get available indexes', function (done) {
    server.get('/api/indexes')
      .set('Authorization', 'Bearer ' + token)
      .expect('Content-Type', /json/)
      .end(function (err, res) {

        // Check that the created index exists and is the only index.
        res.body.should.have.length(1);
        res.body[0].should.have.properties({
          'index': 'e374e212db3409573917dd6e968c83ba',
          'name': 'Test',
          'tag': 'private'
        });
        res.status.should.equal(200);

        done();
      });
  });

  it('Add content (first)', function (done) {
    // post /api
    server.post('/api')
      .set('Authorization', 'Bearer ' + token)
      .send({
        "index": index,
        "type": "page",
        "data": content[0]
      })
      .expect('Content-Type', /json/)
      .end(function (err, res) {

        // Check that the created index exists and is the only index.
        res.status.should.equal(201);

        done();
      });
  });

  it('Add content (last)', function (done) {
    // post /api
    server.post('/api')
      .set('Authorization', 'Bearer ' + token)
      .send({
        "index": index,
        "type": "page",
        "data": content[1]
      })
      .expect('Content-Type', /json/)
      .end(function (err, res) {

        // Check that the created index exists and is the only index.
        res.status.should.equal(201);

        done();
      });
  });

  it('Search simple', function (done) {
    var query = {
      "query": {
        "filtered": {
          "query": {
            "multi_match": {
              "query": "ad dolor",
              "fields": [
                "title",
                "content"
              ],
              "analyzer": "string_search"
            }
          },
          "filter": {
            "bool": {
              "must": [
                {
                  "terms": {
                    "execution": "and",
                    "field_level": [
                      "First"
                    ]
                  }
                }
              ]
            }
          }
        }
      },
      "size": 14,
      "from": 0,
      "aggs": {
        "Level": {
          "terms": {
            "field": "field_level.raw",
            "size": 0
          }
        }
      }
    };

    // Allow this test to run for more than 2 seconds.
    this.timeout(5000);

    // Content added in laste test have to be indexed, so just wait 1 second
    // before searching.
    setTimeout(function () {
      server.post('/api/search')
        .set('Authorization', 'Bearer ' + token)
        .send({
          "index": index,
          "type": "page",
          "query": query
        })
        .expect('Content-Type', /json/)
        .end(function (err, res) {
          // Only one result should be returned.
          res.body.hits.should.equal(2);

          // Test aggs.
          res.body.aggs.Level.buckets[0].doc_count.should.equal(2);
          res.body.aggs.Level.buckets[1].doc_count.should.equal(1);

          // Check HTTP status.
          res.status.should.equal(200);

          done();
        });
    }, 1000);
  });

  it('Update content (TODO)', function (done) {
    // put /api

    // Search

    done();
  });

  it('Remove content (TODO)', function (done) {
    // delete /api

    done();
  });


});

/**
 * Administration API.
 */
describe('Admin API (TODO)', function() {
  /**
   * @TODO: Test admin API
   */
  it('Test admin API', function (done) {
    done();
  });

});

/**
 * Socket.io used by most front-end implementations.
 */
describe('Socket tests (TODO)', function() {
  /**
   * @TODO: Test sockets
   */
  it('Test socket.io', function (done) {
    done();
  });

});

/**
 * Take down the test data.
 */
describe('Remove data and indexes', function() {
  it('Flush index', function (done) {
    server.delete('/api/' + index + '/flush')
      .set('Authorization', 'Bearer ' + token)
      .expect('Content-Type', /json/)
      .end(function (err, res) {

        res.status.should.equal(200);

        done();
      });
  });

  it('Deactivate index (TODO)', function (done) {
    done();
  });

  it('Remove index', function (done) {
    server.delete('/api/' + index + '/remove')
      .set('Authorization', 'Bearer ' + token)
      .expect('Content-Type', /json/)
      .end(function (err, res) {

        res.status.should.equal(200);

        done();
      });
  });

});