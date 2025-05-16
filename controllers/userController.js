const { ReturnDocument, ObjectId } = require("mongodb");
const { getUsersCollection } = require("../config/db");

const getUserProfile = async (req, res, next) => {
  try {
    const { email } = req.user;
    const user = await getUsersCollection().findOne({ email, role: "user" });

    if (!user) {
      return res
        .status(403)
        .send({ message: "You are not authorized to view this Profile" });
      res.send({
        name: user.name,
        image: user.image,
        email: user.email,
        badge: user.badge,
      });
    }
  } catch (error) {
    console.error("Failed to fetch user profile:", error);
    res.status(500).send({ message: "Failed to fetch user profile" });
  }
};

const updateUserProfile = async (req, res, next) => {
  try {
    const { email } = req.user;
    const { name, image } = req.body;

    const updatedUser = await getUserProfile().updateOne(
      { email },
      { $set: { name, image } },
      { ReturnDocument: "after" }
    );

    if (!updatedUser.value) {
      return res.status(404).send({ message: "User not found" });
    }

    res.send({
      message: "Profile updated successfully!",
      user: updatedUser.value,
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).send({ message: "Failed to update profile" });
  }
};

const createUser = async (req, res, next) => {
  try {
    const email = req.params.email;
    const query = { email };
    const user = req.body;
    const isExist = await getUsersCollection().findOne(query);

    if (isExist) {
      return res.send({ message: "User exist" });
    }

    const result = await getUsersCollection().insertOne({
      name,
      image,
      email,
      ...user,
      badge: "Bronze",
      role: "user",
    });

    res.send(result);
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).send({ message: "Failed to create user" });
  }
};

const makeAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const query = { _id: new ObjectId(id) };
    const update = { $set: { role: "admin" } };

    const user = await getUsersCollection().findOne(query, update);

    if (user.matchedCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const updateUser = await getUsersCollection().findeOne(query);

    res.send(updateUser);
  } catch (error) {
    console.error("Error updating user role:", error);
    res.status(500).send({ message: "Error updating user role" });
  }
};

module.exports = { getUserProfile, updateUserProfile, createUser, makeAdmin };
