const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const { MongoClient } = require('mongodb');
const SSLCommerzPayment = require('sslcommerz');
const { v4: uuidv4 } = require('uuid');

const port = process.env.PORT || 5000;


app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uri = "mongodb+srv://event_horizon:0lvvrMejiTM1SNFp@cluster0.mb5mgqx.mongodb.net/?retryWrites=true&w=majority";
// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.j9nln.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });


async function run() {
    try {
        await client.connect();

        const database = client.db('event_horizon');
        const usersCollection = database.collection('users');
        const ordersCollection = database.collection('orders');


        // sslcommerz payment initialization
        app.post('/init', async (req, res) => {
            const tran_id = uuidv4();
            const data = {
                total_amount: req.body.total_amount,
                currency: 'BDT',
                tran_id: tran_id,
                success_url: 'http://localhost:5000/success',
                fail_url: 'http://localhost:5000/fail',
                cancel_url: 'http://localhost:5000/cancel',
                ipn_url: 'http://localhost:5000/ipn',
                shipping_method: 'Online transaction',
                product_name: req.body.product_name,
                product_image: req.body.product_image,
                product_category: 'Event Rent',
                product_profile: req.body.product_profile,
                cus_name: req.body.cus_name,
                cus_email: req.body.cus_email,
                cus_add1: 'Dhaka',
                cus_add2: 'Dhaka',
                cus_city: 'Dhaka',
                cus_state: 'Dhaka',
                cus_postcode: '1000',
                cus_country: 'Bangladesh',
                cus_phone: '01711111111',
                cus_fax: '01711111111',
                ship_name: 'Customer Name',
                ship_add1: 'Dhaka',
                ship_add2: 'Dhaka',
                ship_city: 'Dhaka',
                ship_state: 'Dhaka',
                ship_postcode: 1000,
                ship_country: 'Bangladesh',
                multi_card_name: 'mastercard',
                value_a: 'ref001_A',
                value_b: 'ref002_B',
                value_c: 'ref003_C',
                value_d: 'ref004_D'
            };

            req.body.order.tran_id = tran_id;
            req.body.order.val_id = "";
            req.body.order.customerTran_id = "";

            const order = await ordersCollection.insertOne(req.body.order);

            const sslcommer = new SSLCommerzPayment(process.env.STORE_ID, process.env.STORE_PASSWORD, false) //true for live default false for sandbox
            sslcommer.init(data).then(data => {
                if (data.GatewayPageURL) {
                    res.json(data.GatewayPageURL)
                }
                else {
                    return res.status(400).json({
                        message: 'Payment session failed.'
                    })
                }
            });
        })

        // Payment success
        app.post('/success', async (req, res) => {
            const result = await ordersCollection.updateOne({ tran_id: req.body.tran_id }, {
                $set: {
                    val_id: req.body.val_id
                }
            });

            res.redirect(`http://localhost:3000/success/${req.body.val_id}`)
        })


        // Payment fail
        app.post('/fail', async (req, res) => {
            const result = await ordersCollection.deleteOne({ tran_id: req.body.tran_id });
            res.status(400).redirect('http://localhost:3000');
        })

        // Payment cancel
        app.post('/cancel', async (req, res) => {
            const result = await ordersCollection.deleteOne({ tran_id: req.body.tran_id });
            res.status(400).redirect('http://localhost:3000');
        })

    

        // Add customer transaction id
        app.put('/validate', async (req, res) => {
            const data = req.body;
            const filter = { val_id: data.val_id };
            const updateDoc = {
                $set: {
                    customerTran_id: data.customerTran_id
                }
            };
            const result = await ordersCollection.updateOne(filter, updateDoc);
            res.json(result);
        });








        
        // Add Users API
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email };
            const email = await usersCollection.findOne(query);
            if (!email) {
                const result = await usersCollection.insertOne(user);
                res.json(result);
            }
        })


        // Get Users API
        app.get('/users', async (req, res) => {
            const cursor = usersCollection.find({});
            const users = await cursor.toArray();
            res.send(users);
        });


        // Get Orders API
        app.get('/orders', async (req, res) => {
            const cursor = ordersCollection.find({});
            const orders = await cursor.toArray();
            res.send(orders);
        });


        // Orders Cancel API
        app.put('/cancel_order', async (req, res) => {
            const data = req.body;
            const filter = {
                customerName: data.customer,
                Day: data.day,
                Slot: data.timeSlot,
            };
            const updateDoc = { $set: { status: data.status } };
            const result = await ordersCollection.updateOne(filter, updateDoc);
            res.json(result);
        });


        // Delete owner/customer API
        app.delete('/delete_owner_customer', async (req, res) => {
            const data = req.body;
            const query = { email: data.email };
            const result = await usersCollection.deleteOne(query);
            res.json(result);
        })


        // Venue accept/reject API
        app.put('/venue_action', async (req, res) => {
            const data = req.body;
            const filter = {
                'venues.name': data.venueName
            };
            const updateDoc = { $set: { 'venues.$.status': data.action } };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.json(result);
        });


        // Owner profile update 
        app.put('/owner_profile', async (req, res) => {
            const data = req.body;
            const filter = {
                email: data.emailAddress
            };
            const updateDoc = {
                $set: {
                    name: data.name,
                    phoneNo: data.phoneNo,
                    address: data.address
                }
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.json(result);
        });



        // Delete owner venue API
        app.delete('/owner_venue', async (req, res) => {
            const data = req.body;
            const query = { email: data.email };
            const result = await usersCollection.updateOne(query, { $pull: { venues: data.venue } });
            res.json(result);
        })


        // Venue setup API
        app.put('/venue_setup', async (req, res) => {
            const data = req.body;
            const filter = {
                email: data.email
            };
            const updateDoc = {
                $push: {
                    "venues": data.venue
                }
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.json(result);
        });

        // Venue Update API
        app.put('/venue_update', async (req, res) => {
            const data = req.body;
            const filter = {
                email: data.emailAddress,
                'venues.name': data.oldVenue
            };
            const updateDoc = {
                $set: {
                    'venues.$.name': data.venue.name,
                    'venues.$.venueRegNo': data.venue.venueRegNo,
                    'venues.$.venuePrice': data.venue.venuePrice,
                    'venues.$.venueImgLink': data.venue.venueImgLink,
                    'venues.$.location': data.venue.location,
                    'venues.$.capacity': data.venue.capacity,
                    'venues.$.size': data.venue.size,
                    'venues.$.amenities': data.venue.amenities,
                    'venues.$.availability': data.venue.availability
                }
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.json(result);
        });


        // Order accepted/rejected API
        app.put('/order_action', async (req, res) => {
            const data = req.body;
            const filter = {
                venueName: data.order.venueName,
                customerEmail: data.order.customerEmail,
                Day: data.order.Day,
                Slot: data.order.Slot
            };
            const updateDoc = {
                $set: {
                    status: data.action
                }
            };
            const result = await ordersCollection.updateOne(filter, updateDoc);
            res.json(result);
        });



        // Owner venue order API
        app.post('/add_booking', async (req, res) => {
            const order = req.body;
            const userEmail = order.userEmail;
            const venueName = order.venueName;
            const bookedInfo = order.bookedInfo;
            const result = await usersCollection.updateOne(
                { email: userEmail, 'venues.name': venueName },
                {
                    $set: { 'venues.$.booked': true },
                    $push: { 'venues.$.bookedInfo': bookedInfo }
                }
            );
            res.json(result);
        });



    }

    finally {
        // await client.close();
    }
}

run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Event Horizon server is running')
})

app.listen(port, () => {
    console.log(`Listening at ${port}`)
})